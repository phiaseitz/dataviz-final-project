// Create the Google Map…
var map = new google.maps.Map(d3.select("#map").node(), {
  zoom: 4,
  center: new google.maps.LatLng(39.828215,-98.5817593),
  mapTypeId: google.maps.MapTypeId.ROADMAP
});

map.setOptions({styles: styles});
google.maps.event.addDomListener(window, 'load', map);

var overlay = new google.maps.OverlayView();

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
  createOverlay(...values, true);
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

  overlay.onRemove = function(){
    // var layer= d3.select(this.getPanes().overlayMouseTarget);
    // layer.select("div").parentNode.removeChild(layer.select("div"))
    // layer.select("div") = null;
    this.div_.parentNode.removeChild(this.div_);
    this.div_ = null;
    console.log("removeMap");
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
  const height = svg[0][0].clientHeight;

  // Center donut viz in square SVG
  const viz = svg.append("g")
    .attr("transform", `translate( ${width/2}, ${height - width/2})`);

  const maxRadius = 0.4 * width;
  const minRadius = 0.2 * width;

  const textRadius = maxRadius *1.15;
  const radiusScale = d3.scale.linear()
    .domain([0, 1])
    .range([minRadius, maxRadius]);

  const bkgArc = d3.svg.arc()
    .outerRadius(maxRadius)
    .innerRadius(minRadius);

  const natAvgArc = d3.svg.arc()
    .outerRadius(radiusScale(0.5) + 1)
    .innerRadius(radiusScale(0.5));

  const arc = d3.svg.arc()
    .innerRadius(minRadius);

  const labelArc = d3.svg.arc()
    .innerRadius(textRadius)
    .outerRadius(textRadius);

  const pie = d3.layout.pie()
    .sort(null)
    .padAngle(.04)
    .value(d => d.weight);

  const g = viz.selectAll(".metricGroup")
    .data(pie(criteria))
    .enter()
    .append("g")
    .attr("class", "metricGroup")
    .attr("id", d => d.data.name + "Group");

  g.each(function(d){
     // d.data is actually a criterion
      d.normedValue = evaluateDatum(datum, [d.data]);

      // Convert the normedValue to an area and calculate the corresponding
      // outer radius
      const maxArea = Math.pow(maxRadius, 2) - Math.pow(minRadius, 2);
      const desiredArea =  maxArea * d.normedValue;
      d.outerRadius =  Math.sqrt( desiredArea + Math.pow(minRadius, 2));

      /*I'm open to other suggestions for how to do this, but we can't do the mouseover
      event without somehow appending the datum to the data or using global variables.
      This is unfrotunatle because it appends the datum three times, but I wasn't sure
      if stuff would break if I broke the datum down into more pieces.

      If we don't do this, the mouseover/drilldown just always uses the first datum.*/
      d.datum = datum;
    })
    .append("path")
    .attr("d", arc)
    .style("fill", (d, i) =>  DONUT_COLORS[i])
    .attr("id", d => d.data.name + "rating")
    .attr("class", "rating");

  g.append("path")
    .attr("d", bkgArc)
    .style("fill", (d, i) =>  DONUT_COLORS[i])
    .style('opacity', 0.2)
    .attr("id", d => d.data.name + "bkg")
    .attr("class", "bkgArc staticRad")
    .on("mouseover", function(d,i){
      donutDrilldown(d.datum, d, radiusScale, arc, DONUT_COLORS[i], maxRadius);
    })
    .on("mouseout", function(d){
      exitDonutDrilldown(d);
    });

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
    .each(function(d){
      //This is gross and I don't like setting the outer and inner radii here, but it makes updating much
    })
    .attr("d", natAvgArc)
    .attr("class", "natAvgLine staticRad")
    .attr("id", d => d.data.name + "natAvgLine");

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

function donutDrilldown(datum, criteria, radiusScale, arc, color, maxRadius){
  const metricRatingArc = d3.select("#" + criteria.data.name + "rating");
  const metricRatingGroup = d3.select(metricRatingArc.node().parentNode);
  const natAvgLine = d3.select("#" + criteria.data.name + "natAvgLine");

  metricRatingArc.style("visibility", "hidden");
  natAvgLine.style("visibility","hidden");

  const natAvgArc = d3.svg.arc()
    .outerRadius(radiusScale(0.5) + 1)
    .innerRadius(radiusScale(0.5));

  const drilldownColor = d3.scale.linear()
    .domain([0, 1])
    .range(["#FFFFFF", color]);

  const drilldownPie = d3.layout.pie()
    .sort(null)
    .padAngle(.04)
    .value(d => d.weight)
    .startAngle(criteria.startAngle)
    .endAngle(criteria.endAngle);

  const drilldown = metricRatingGroup.selectAll(".drilldownData")
    .data(drilldownPie(criteria.data.components))
    .enter()
    .append("g")
    .attr("class", "drilldownData");

  drilldown.each(function (d) {
      d.outerRadius = radiusScale(evaluateDatum(datum, [d.data]));
    })
    .append("path")
    .attr("d", arc)
    .style("fill", function(d,i){
      const percentThrough = i/(criteria.data.components.length);
      //offset the percent though so we don't get a white square
      return drilldownColor(0.75*percentThrough + 0.25);
    })
    .style("stroke-width", 2)
    .style("stroke", "white");

  drilldown.append("path")
    .attr("d", natAvgArc)
    .attr("class","drilldownNatAvg");

  //Add the legend
  drilldown.append("rect")
    .attr("x", -100)
    .attr("y", function(d,i){
      return -(maxRadius +50 + (i) *25);
    })
    .attr("width", 20)
    .attr("height", 20)
    .attr("fill", function(d,i){
      const percentThrough = i/(criteria.data.components.length);
      //offset the percent though so we don't get a white square
      return drilldownColor(0.75*percentThrough + 0.25);
    });

  drilldown.append("text")
    .attr("x", -75)
    .attr("y", function(d,i){
      return -(maxRadius +50 + (i) *25);
    })
    .attr("dy", "1em")
    .attr("font-size", "14px")
    .text(d => d.data.name);
}

function exitDonutDrilldown(criteria){
  const metricRatingArc = d3.select("#" + criteria.data.name + "rating");
  const natAvgLine = d3.select("#" + criteria.data.name + "natAvgLine");

  metricRatingArc.style("visibility", "visible");
  natAvgLine.style("visibility","visible");

  const metricRatingGroup = d3.select(metricRatingArc.node().parentNode);
  metricRatingGroup.selectAll(".drilldownData").remove();
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

  const textRadius = maxRadius * 1.15;

  var score = 0;
  var sumOfWeights = 0;

  const isUpdatingRadius = !(_.isEmpty(datum));

  const radiusScale = d3.scale.linear()
    .domain([0, 1])
    .range([minRadius, maxRadius]);

  const bkgArc = d3.svg.arc()
    .outerRadius(maxRadius)
    .innerRadius(minRadius);

  const natAvgArc = d3.svg.arc()
    .outerRadius(radiusScale(0.5) + 1)
    .innerRadius(radiusScale(0.5));

  const arc = d3.svg.arc()
    .innerRadius(minRadius);

  const labelArc = d3.svg.arc()
    .innerRadius(textRadius)
    .outerRadius(textRadius);

  const updatePie = d3.layout.pie()
    .sort(null)
    .value(d => d.weight);

  const newPieData = updatePie(criteria);

  //Animate the new radius.
  const criteriaGroups = viz.selectAll(".metricGroup");

  //Add new radius and angle information here. 
  criteriaGroups.each(function(d,i){
    d.datum = datum;
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

  const criteriaArcs = criteriaGroups.selectAll(".rating");

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

  //These are arcs where we don't need to update the radius, just the start and end angle
  const staticRadArcs = criteriaGroups.selectAll(".staticRad");

  staticRadArcs.transition()
    .duration(1000)
    .attrTween("d", function(d,i) {
      const isBkgArc = this.classList.contains("bkgArc");
      var interpolateEnd = d3.interpolate(d.endAngle, d.newEnd);
      var interpolateStart = d3.interpolate(d.startAngle,d.newStart);
      return function(t) {
          d.endAngle = interpolateEnd(t);
          d.startAngle = interpolateStart(t);
          return isBkgArc ? bkgArc(d) : natAvgArc(d);
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

function updateMapOverlay(){
  overlay.setMap(null);
  overlay.setMap(map);
}

/**
node-ztable
-----------

This code, originally packaged for node, is taken from
https://github.com/arjanfrans/node-ztable and is used to move from a statistical
z-score to a percentile.

Fun-Fact: The code was originally bugged. But thanks to the miracle of
open-source, it has been fixed here and a PR has been submitted to the repo
from whence it came.

*/

/**
 * A helper function that, given a z-score (std deviations from the mean)
 * returns the percentile to which that z-score maps.
 *
 * @param  {Number} zscore A z-score, the number of std. deviations from a mean
 * @return {Number}        A percentile, as a 0-1 value
 */
function ztable(zscore) {
  // Clean arguments
  if (isNaN(zscore)) {
    console.warn("ERROR: zscore", zscore, "is not a number!" )
    return undefined
  }

  // Handle edge cases
  if (zscore === 0) return 0.5000;
  else if (zscore > 3.49) return 1;
  else if (zscore < -3.49) return 0;

  let percentile;

  if (zscore > 0) percentile = 1-ZTABLE[(-zscore).toFixed(2)];
  else percentile = ZTABLE[zscore.toFixed(2)];

  return percentile;
}

function bindControls(criteria) {
  d3.select("#loadingIndicator").remove();
  const controls = d3.select("#controls");
  createCategoryControls(controls, criteria);

}

function createCategoryControls(target, criteria) {
  const categoryControls = target.append("div")
    .attr("id", "categoryControls")
    .selectAll(".categoryControl")
    .data(criteria)
    .enter()
    .append("div")
    .attr("class", "categoryControl");

  categoryControls.append("label")
    .text(criterion => criterion.name);

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