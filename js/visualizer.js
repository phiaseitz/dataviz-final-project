// Create the Google Map…
var map = new google.maps.Map(d3.select("#map").node(), {
  zoom: 4,
  center: new google.maps.LatLng(39.828215,-98.5817593),
  mapTypeId: google.maps.MapTypeId.ROADMAP
});

map.setOptions({styles: styles});

const COLORS = d3.scale.linear()
  .domain([0, 1])
  .range(["black", "#cedb9c"]);

const DONUT_COLORS = ["#779FA1", "#FF6542", "#564154"];


// Get the hospital data and ratingCriteria in parallel, but wait until
// both arrive before excecuting the callback.
Promise.all([
  new Promise((resolve, reject) => d3.json("hospitalData.json", resolve)),
  new Promise((resolve, reject) => d3.json("ratingCriteria.json", resolve)),
]).then(values => {
  createOverlay(...values, true)
  const [data, criteria] = values;
  bindControls(criteria);
});


/**
 * Generates a Google Maps overlay with a marker representing each hospital.
 * The hospital markers are color-coded according to a 'hospital score' based
 * on user-weightings. The markers are also clickable. When clicked, a sidebar
 * will appear giving further detail on the selected hospital.
 * @param  {Object} data           The hospital data
 * @param  {Object} criteria       The criteria with which to evaluate the data
 * @param  {Boolean} verbose=false A flag for console output
 */
function createOverlay(data, criteria, verbose=false) {
  var overlay = new google.maps.OverlayView();

  // Add the container when the overlay is added to the map.
  overlay.onAdd = function() {
    //var layer = d3.select(this.getPanes().overlayLayer).append("div")
    //    .attr("class", "hospitals");
    var layer = d3.select(this.getPanes().overlayMouseTarget)
      .append("div")
      .attr("class", "hospitals");

    // Draw each marker as a separate SVG element.
    // We could use a single SVG, but what size would it have?
    overlay.draw = function() {
      var projection = this.getProjection(),
          padding = 10;

      var marker = layer.selectAll("svg")
          .data(d3.entries(data))
          .each(transform) // update existing markers
        .enter().append("svg:svg")
          .each(transform)
          .attr("class", "marker");

      // Add a circle.
      marker.append("svg:circle")
        .attr({
          r: 6,
          cx: padding,
          cy: padding,
          id: d => d.key,
          fill: d => COLORS(evaluateDatum(d.value, criteria, verbose)),
        })
        .on("mouseenter", function (d) {
          const circle = d3.select(this);

          d3.select("#tooltip")
            .style({display: "initial"})
            .style({
              left: circle[0][0].offsetParent.offsetLeft + 20 + "px",
              top: circle[0][0].offsetParent.offsetTop + "px",
            })
            .text(d.value["Hospital"].toLowerCase());

          // Increase circle radius
          d3.select(this).attr("r", 8);
        })
        .on("mouseleave", function (d) {
          // Make tooltip invisible
          d3.select("#tooltip")
            .style("display", "none");

          // Restore circle radius
          d3.select(this).attr("r", 6);
        })
        .on("click", function (d) {
          updateSidebar(d.value, criteria);

          // Deselect last selection
          const lastSelection = d3.select(".selectedHospital");
          if (!lastSelection.empty()) {
            const normedValue = evaluateDatum(
              lastSelection.datum().value,
              criteria
            );

            lastSelection.classed("selectedHospital", false)
              .attr("fill", COLORS(normedValue));
          }

          // Select this element
          const currentSelection = d3.select(this);

          currentSelection.classed("selectedHospital", true)
            .attr("fill", "#FF6542");
        });


      function transform(d) {
        d = new google.maps.LatLng(d.value["Lat"], d.value["Long"]);
        d = projection.fromLatLngToDivPixel(d);
        return d3.select(this)
            .style("left", (d.x - padding) + "px")
            .style("top", (d.y - padding) + "px");
      }
    };
  };

  // Bind our overlay to the map…
  overlay.setMap(map);
}

/**
 * A function to evaluate a datum to a 0-1 normalized score based on the
 * passed criteria.
 *
 * @param  {Object}  datum         An object to evaluate
 * @param  {Object}  criteria      The criteria by which to evaluate the datum
 * @param  {Boolean} verbose=false A flag for console output
 * @return {Number}                A 0-1 normalized score
 */
function evaluateDatum(datum, criteria, verbose=false) {
  let weightedSumOfMetrics = 0;
  let sumOfWeights = 0;

  criteria.forEach((criterion) => {
    if ("components" in criterion) {
      const { weight, components } = criterion;
      weightedSumOfMetrics += weight * evaluateDatum(
        datum,
        components,
        verbose
      );
      sumOfWeights += criterion["weight"];
    } else if (
      "metric" in criterion &&
      "invert" in criterion &&
      "distribution" in criterion
    ) {
      const { metric, invert, distribution, weight } = criterion;
      const rawValue = accessValue(datum, metric);

      // If the metric value is unavailable, ignore this metric and weighting
      if (!_.isUndefined(rawValue)) {
        const normedValue = getNormalizedValue(rawValue, distribution);
        const metricValue = invert ? 1-normedValue : normedValue;

        weightedSumOfMetrics += weight * metricValue;
        sumOfWeights += weight;
      }
    } else console.warn(
      "ERROR: criterion '",
      criterion,
      "' does not have all of the necessary properties"
    );
  });

  // Divide out sum by the acumulated weights
  if (sumOfWeights === 0) return 0;
  return weightedSumOfMetrics / sumOfWeights;
}

/**
 * A helper function to convert a raw metric value to a percentile. Given a
 * distribution object (mean and standard deviation), this function returns
 * the percentile (from 0-1) in which that raw value falls.
 * @param  {Number} rawValue     The value of the metric
 * @param  {Object} distribution An object containing mean and std deviation
 * @return {Number}              A 0-1 score representing a percentile
 */
function getNormalizedValue(rawValue, distribution) {
  const { mean, stdDev } = distribution;
  if (stdDev === 0) return 0.5; // Avoid 0 division
  const zScore = (rawValue - mean) / stdDev;
  return ztable(zScore);
}

/**
 * A helper function which recursively reaches into a possibly nested Object
 * to retrieve the value specified via the provided list of keys.
 *
 * @param  {Object} datum A hospital datum
 * @param  {Array}  keys  An array of string propnames
 * @param  {Boolean} verbose=false  A flag for displaying console output
 * @return {Number}       The value stored at the end of the keys chain
 */
function accessValue(datum, keys, verbose=false) {
  // FIXME: There may be a better way to indicate an invalid value than
  // returning 0, which will unfairly indicate that this hospital is very
  // poor at whatever this metric evaluation is
  const key = keys[0];

  if (_.isUndefined(key) || !(key in datum)) {
    if (verbose) console.warn("ERROR: key '", key, "' is not in the following datum.", datum);
    return undefined;
  }
  else if (keys.length > 1) return accessValue(datum[key], keys.slice(1));
  else if(isNaN(datum[key].replace(/[^0-9\.]+/g, ""))) {
    if (verbose) console.warn("ERROR: value '", datum[key], "' cannot be parsed to a number.");
    return undefined;
  }
  else return Number(datum[key].replace(/[^0-9\.]+/g, ""));
}

/**
 * Given a hospital's datum, insert the relevant fields into the correct place
 * in the details sidebar and show the sidebar.
 *
 * @param  {Object} datum The datum describing a hospital
 * @param  {Object} criteria The criteria by which to evaluate the datum
 * Check if the sidebar is already open.
 * If so, update it, otherwise, remove everything and draw it
 * again*/

function updateSidebar(datum={}, criteria=[]) {
  const sidebar = d3.select('#detailSidebar');
  const isShowing = sidebar.classed('show');
  const haveData = !(_.isEmpty(datum));

  //Update either the radius or the angle
  if (isShowing) {
    updateDonutChart('#hospitalDonut', datum, criteria)
  //This is the case where we have clicked on a hospital
  } else if (!isShowing && haveData) {
    sidebar.classed('show', true);
    addDonutChart('#hospitalDonut', datum, criteria);
  }

  //If we clicked on a hospital, update the data
  if (haveData){
    d3.select('#hospitalNameField')
    .text(datum['Hospital'].toLowerCase());

    const { Address } = datum;

    d3.select('#addressField')
      .text(Address['StreetAddress'].toLowerCase());

    d3.select('#cityField')
      .text(Address['City'].toLowerCase());

    d3.select('#stateField')
      .text(Address['State']);

    d3.select('#zipField')
      .text(Address['ZIP']);
  }
}

function addDonutChart(target, datum, criteria=[]) {

  // TODO: Add a margin around the chart. Right now, a small width may cause
  // the text on the bottom to be cut-off

  const svg = d3.select(target);
  //Remove everything before drawing it again.
  svg.selectAll("*").remove();

  const width = svg[0][0].clientWidth;
  svg.attr("height", width); //make SVG square

  // Center donut viz in square SVG
  const viz = svg.append("g")
    .attr("transform", `translate( ${width/2}, ${width/2})`);

  const maxRadius = 0.4 * width;
  const minRadius = 0.2 * width;

  const textRadius = maxRadius *1.15;
  const radiusScale = d3.scale.linear()
    .domain([0, 1])
    .range([minRadius, maxRadius]);

  // Background circle (shows "maxValue")
  const bkgArc = d3.svg.arc()
    .outerRadius(maxRadius)
    .innerRadius(minRadius)
    .startAngle(0)
    .endAngle(2*Math.PI);

  viz.append("g")
    .attr("class", "bkgArc")
    .append("path")
    .attr("d", bkgArc)
    .attr("fill", "lightgray");

  const arc = d3.svg.arc()
    .innerRadius(minRadius);

  const labelArc = d3.svg.arc()
    .innerRadius(textRadius)
    .outerRadius(textRadius);

  const pie = d3.layout.pie()
    .sort(null)
    .value(d => d.weight);

  const g = viz.selectAll(".arc")
    .data(pie(criteria))
    .enter()
    .append("g")
    .attr("class", "arc");

  g.each(function(d){
     // d.data is actually a criterion
    d.normedValue = evaluateDatum(datum, [d.data]);

    // Convert the normedValue to an area and calculate the corresponding
    // outer radius
    const maxArea = Math.pow(maxRadius, 2) - Math.pow(minRadius, 2);
    const desiredArea =  maxArea * d.normedValue;
    d.outerRadius =  Math.sqrt( desiredArea + Math.pow(minRadius, 2));
    })
    .append("path")
    .attr("d", arc)
    .style("fill", (d, i) =>  DONUT_COLORS[i])
    .attr("class", "criteriaSlice");

  g.append("text")
    .attr("dy", ".35em")
    .attr("x", function (d) {
      const textAngle = (d.endAngle + d.startAngle)/2;
      return textRadius * Math.sin(textAngle);
    })
    .attr("y", function(d){
      const textAngle = (d.endAngle + d.startAngle)/2;
      return -textRadius * Math.cos(textAngle);
    })
    .attr("text-anchor", "middle")
    .text(d => d.data.name)
    .attr("class", "metricLabel");

  viz.append("text")
    .attr("class", "stars")
    .attr("x", 0) //centered w/ transform
    .attr("y", 0) //center w/ transform
    .attr("font-size", "30px")
    .attr("text-anchor", "middle")
    .text(d3.round(evaluateDatum(datum, criteria)*5, 2) + " / 5")// convert to weighted "star" rating
    .append("tspan")
    .attr("dy", "1.2em")
    .attr("x", 0)
    .attr("font-size", "16px")
    .text("stars");

  //the national average line. Not creating an arc variable
  //for this because we don't know any of the parameters
  //ahead of time.
  //Also, it seems like these are all 0.5, even though the
  //mean is not necessarily 50th percentile
  g.append("path")
    .attr("d", d3.svg.arc()
      .innerRadius(function(d) {
        //We assume the data is normally distributed, so the mean
        //is the 50th percentile
        return radiusScale(0.5);})
      .outerRadius(function(d){
        return radiusScale(0.5) + 1;}));

  viz.append("line")
    .style("stroke", "black")
    .attr("x1", -100)
    .attr("y1", -(maxRadius + 15))
    .attr("x2", -80)
    .attr("y2",  -(maxRadius + 15))
    .attr("class", "natAvgLegend");

  viz.append("text")
    .attr("x", -75)
    .attr("y", -(maxRadius + 15))
    .attr("dy", "0.35em")
    .attr("font-size", "14px")
    .text("National Average");
}


function updateDonutChart(target, datum={}, criteria=[]) {
  // TODO: Add a margin around the chart. Right now, a small width may cause
  // the text on the bottom to be cut-off

  //TODO: Handle resizing of the window.

  const svg = d3.select(target);

  const viz = svg.select("g");

  const width = svg[0][0].clientWidth;

  const maxRadius = 0.4 * width;
  const minRadius = 0.2 * width;

  const textRadius = maxRadius + 20; // padding = 20

  var score = 0;
  var sumOfWeights = 0;

  const isUpdatingRadius = !(_.isEmpty(datum));

  const radiusScale = d3.scale.linear()
    .domain([0, 1])
    .range([minRadius, maxRadius]);

  const labelArc = d3.svg.arc()
    .innerRadius(textRadius)
    .outerRadius(textRadius);

  const arc = d3.svg.arc()
    .innerRadius(minRadius);

  const updatePie = d3.layout.pie()
    .sort(null)
    .value(d => d.weight);

  const newPieData = updatePie(criteria);

  //Animate the new radius.
  const criteriaGroups = viz.selectAll(".arc");

  //Add new radius information here. We'll do the same with
  //new angle information shortly.
  criteriaGroups.each(function(d,i){
    if (isUpdatingRadius) {
      d.normedValue = evaluateDatum(datum, [d.data]);
      d.newOuter = radiusScale(d.normedValue);
    } else d.newOuter = d.outerRadius;

    score += d.data.weight * d.normedValue;
    sumOfWeights += +d.data.weight;
    //reset everything but the start and end angles
    d.newStart = newPieData[i].startAngle;
    d.newEnd = newPieData[i].endAngle;
    d.value = newPieData[i].value;
    d.data = newPieData[i].data;
  });

  const criteriaArcs = criteriaGroups.selectAll(".criteriaSlice");

  criteriaArcs.transition()
    .duration(1000)
    .attrTween("d", function(d,i) {
      var interpolateRad = d3.interpolate(d.outerRadius, d.newOuter);
      var interpolateEnd = d3.interpolate(d.endAngle, d.newEnd);
      var interpolateStart = d3.interpolate(d.startAngle,d.newStart);
      return function(t) {
          d.endAngle = interpolateEnd(t);
          d.startAngle = interpolateStart(t);
          d.outerRadius = interpolateRad(t);
          return arc(d);
      };
    });

  criteriaGroups.selectAll(".metricLabel")
    .transition()
    .duration(1000)
    .attr("x", function (d) {
      const textAngle = (d.newEnd + d.newStart)/2;
      return textRadius * Math.sin(textAngle);
    })
    .attr("y", function(d){
      const textAngle = (d.newEnd + d.newStart)/2;
      return -textRadius * Math.cos(textAngle);
    });

  const starRating = d3.round((sumOfWeights ? score/sumOfWeights : 0) * 5, 2);
  viz.selectAll(".stars")
    .text(starRating + " / 5")
    .append("tspan")
    .attr("dy", "1.2em")
    .attr("x", 0)
    .attr("font-size", "16px")
    .text("stars")
    .style("text-transform", "none");

}

function bindControls(criteria) {
  d3.select("#loadingIndicator").remove();
  const controls = d3.select("#controls");
  createCategoryControls(controls, criteria);
}

function createCategoryControls(target, criteria) {
  target.append("h3")
    .text('I care most about...')
    .attr("class", "control-header");

  const categoryControls = target.append("div")
    .attr("id", "categoryControls")
    .selectAll(".categoryControl")
    .data(criteria)
    .enter()
    .append("div")
    .attr("class", "categoryControl");


  categoryControls.append("label")
    .text(criterion => criterion.name)
    .attr("class", "slider-heading");

  categoryControls.append("input")
    .attr({
      type: "range",
      value: criterion => criterion["weight"],
      max: 1,
      step: 0.05,
    })
    .on("change", function (criterion, index) {
      // Note: this mutates the critera object
      criterion["weight"] = this.value;
      updateSidebar({}, criteria);

      // TODO: Regenerate hospital colors
    })
}

function bindControls(criteria) {
  d3.select("#loadingIndicator").remove();
  const controls = d3.select("#controls");
  createCategoryControls(controls, criteria);
}

function createCategoryControls(target, criteria) {
  target.append("h3")
    .text('I care most about...')
    .attr("class", "control-header");

  const categoryControls = target.append("div")
    .attr("id", "categoryControls")
    .selectAll(".categoryControl")
    .data(criteria)
    .enter()
    .append("div")
    .attr("class", "categoryControl");


  categoryControls.append("label")
    .text(criterion => criterion.name)
    .attr("class", "slider-heading");

  categoryControls.append("input")
    .attr({
      type: "range",
      value: criterion => criterion["weight"],
      max: 1,
      step: 0.05,
    })
    .on("change", function (criterion, index) {
      // Note: this mutates the criteria object
      criterion["weight"] = Number(this.value);
      updateSidebar({}, criteria);
      // TODO: Regenerate hospital colors and donut chart
    })
}
