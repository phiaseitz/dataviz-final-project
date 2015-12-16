// Create the Google Map…
var map = new google.maps.Map(d3.select("#map").node(), {
  zoom: 4,
  center: new google.maps.LatLng(39.828215,-98.5817593),
  mapTypeId: google.maps.MapTypeId.ROADMAP
});

var styles = [
  //This colors the land.
  { featureType: "landscape",
    elementType: "all",
    stylers: [
      {hue: "#669999"},
      {saturation: -10},
      {lightness: 0},
      {visibility: "simplified"}
    ]
  },
  //Points of interest are parks and stuff.
  //We can turn this off
  { featureType: "poi",
    elementType: "all",
    stylers: [
      {hue: "#ffffff"},
      {saturation: -100},
      {lightness: 100},
      {visibility: "off"}
    ]
  },
  //the roads themselves
  { featureType: "road",
    elementType: "geometry",
    stylers: [
      {hue: "#bbc0c4"},
      {saturation: -93},
      {lightness: 31},
      {visibility: "simplified"},
      {weight: 2}
    ]
  },
  //The road labels
  {featureType: "road",
    elementType: "labels",
    stylers: [
      {hue: "#bbc0c4"},
      {saturation: -93},
      {lightness: 31},
      {visibility: "simplified"}
    ]
  },
  {
    featureType: "road.arterial",
    elementType: "labels",
    stylers: [
      {hue: "#bbc0c4"},
      {saturation: -93},
      {lightness: -2},
      {visibility: "simplified"}
    ]
  },
  {featureType: "road.local",
    elementType: "geometry",
    stylers: [
      {hue: "#e9ebed"},
      {saturation: -90},
      {lightness: -8},
      {visibility: "simplified"}
    ]
  },
  {
    featureType: "transit",
    elementType: "all",
    stylers: [
      {hue: "#e9ebed"},
      {saturation: 10},
      {lightness: 69},
      {visibility: "on"}
    ]
  },
  //This changes the color of the water
  {
    featureType: "water",
    elementType: "all",
    stylers: [
      {hue: "#6699ff"},
      {saturation: 100},
      {lightness: 20},
      {visibility: "simplified"}
    ]
  }
];

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
        .on("click", d => showDetails(d.value, criteria));


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
 */
function showDetails(datum, criteria) {
  const sidebar = d3.select('#detailSidebar');
  sidebar.classed('show', true);

  addDonutChart('#hospitalDonut', datum, criteria);

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

function addDonutChart(target, datum, criteria=[]) {

  // TODO: Add a margin around the chart. Right now, a small width may cause
  // the text on the bottom to be cut-off

  const svg = d3.select(target);
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

  // Background circle (shows "maxValue")
  const bkgArc = d3.svg.arc()
    .outerRadius(maxRadius)
    .innerRadius(minRadius);

  const arc = d3.svg.arc()
    .innerRadius(minRadius);

  const labelArc = d3.svg.arc()
    .innerRadius(textRadius)
    .outerRadius(textRadius);

  const pie = d3.layout.pie()
    .sort(null)
    // .padAngle(.02) //Does not work. What?!
    .value(d => d.weight);

  const g = viz.selectAll(".metricGroup")
    .data(pie(criteria))
    .enter()
    .append("g")
    .attr("class", "metricGroup")
    .attr("id", d => d.data.name + "Group");

  g.each(function(d) {
    d.outerRadius = radiusScale(evaluateDatum(datum, [d.data]));
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
    .attr("class", "bkgArc")
    .on("mouseover", function(d,i){
      donutDrilldown(datum, d, radiusScale, arc, DONUT_COLORS[i], maxRadius);
    })
    .on("mouseout", function(d){
      exitDonutDrilldown(d);
    });

  g.append("text")
    .attr("transform", d => `translate( ${labelArc.centroid(d)})`)
    .attr("text-anchor", "middle")
    .text(d => d.data.name);

  viz.append("text")
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
}

function donutDrilldown(datum, criteria, radiusScale, arc, color, maxRadius){
  const metricRatingArc = d3.select("#" + criteria.data.name + "rating");

  const metricRatingGroup = d3.select(metricRatingArc.node().parentNode);

  metricRatingArc.style("visibility", "hidden");

  const drilldownColor = d3.scale.linear()
    .domain([0, 1])
    .range(["#FFFFFF", color]);

  const drilldownPie = d3.layout.pie()
    .sort(null)
    // .padAngle(.02) //Does not work. What?!
    .value(d => d.weight)
    .startAngle(criteria.startAngle)
    .endAngle(criteria.endAngle);

  const drilldown = metricRatingGroup.selectAll(".drilldownData")
    .data(drilldownPie(criteria.data.components))
    .enter()
    .append("g")
    .attr("class", "drilldownData");

  //For some reason I can't get the arcs to animate, so, they don't animate here. 
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

  const metricRatingGroup = d3.select(metricRatingArc.node().parentNode);

  metricRatingArc.style("visibility", "visible");

  metricRatingGroup.selectAll(".drilldownData").remove();
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
};

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
      updateMapOverlay();
      // TODO: Regenerate hospital colors and donut chart
    })
}

const ZTABLE = {
  "-0.00": 0.5,
  "-0.01": 0.4681,
  "-0.02": 0.4721,
  "-0.03": 0.4761,
  "-0.04": 0.4801,
  "-0.05": 0.484,
  "-0.06": 0.488,
  "-0.07": 0.492,
  "-0.08": 0.496,
  "-0.09": 0.5,
  "-0.10": 0.4247,
  "-0.11": 0.4286,
  "-0.12": 0.4325,
  "-0.13": 0.4364,
  "-0.14": 0.4404,
  "-0.15": 0.4443,
  "-0.16": 0.4483,
  "-0.17": 0.4522,
  "-0.18": 0.4562,
  "-0.19": 0.4602,
  "-0.20": 0.3829,
  "-0.21": 0.3897,
  "-0.22": 0.3936,
  "-0.23": 0.3974,
  "-0.24": 0.4013,
  "-0.25": 0.4052,
  "-0.26": 0.409,
  "-0.27": 0.4129,
  "-0.28": 0.4168,
  "-0.29": 0.4207,
  "-0.30": 0.3483,
  "-0.31": 0.352,
  "-0.32": 0.3557,
  "-0.33": 0.3594,
  "-0.34": 0.3632,
  "-0.35": 0.3669,
  "-0.36": 0.3707,
  "-0.37": 0.3745,
  "-0.38": 0.3783,
  "-0.39": 0.3821,
  "-0.40": 0.3121,
  "-0.41": 0.3156,
  "-0.42": 0.3192,
  "-0.43": 0.3228,
  "-0.44": 0.3264,
  "-0.45": 0.33,
  "-0.46": 0.3336,
  "-0.47": 0.3372,
  "-0.48": 0.3409,
  "-0.49": 0.3446,
  "-0.50": 0.2776,
  "-0.51": 0.281,
  "-0.52": 0.2843,
  "-0.53": 0.2877,
  "-0.54": 0.2912,
  "-0.55": 0.2946,
  "-0.56": 0.2981,
  "-0.57": 0.3015,
  "-0.58": 0.305,
  "-0.59": 0.3085,
  "-0.60": 0.2451,
  "-0.61": 0.2483,
  "-0.62": 0.2514,
  "-0.63": 0.2546,
  "-0.64": 0.2578,
  "-0.65": 0.2611,
  "-0.66": 0.2643,
  "-0.67": 0.2676,
  "-0.68": 0.2709,
  "-0.69": 0.2743,
  "-0.70": 0.2148,
  "-0.71": 0.2177,
  "-0.72": 0.2206,
  "-0.73": 0.2236,
  "-0.74": 0.2266,
  "-0.75": 0.2296,
  "-0.76": 0.2327,
  "-0.77": 0.2358,
  "-0.78": 0.2389,
  "-0.79": 0.242,
  "-0.80": 0.1867,
  "-0.81": 0.1894,
  "-0.82": 0.1922,
  "-0.83": 0.1949,
  "-0.84": 0.1977,
  "-0.85": 0.2005,
  "-0.86": 0.2033,
  "-0.87": 0.2061,
  "-0.88": 0.209,
  "-0.89": 0.2119,
  "-0.90": 0.1611,
  "-0.91": 0.1635,
  "-0.92": 0.166,
  "-0.93": 0.1685,
  "-0.94": 0.1711,
  "-0.95": 0.1736,
  "-0.96": 0.1762,
  "-0.97": 0.1788,
  "-0.98": 0.1814,
  "-0.99": 0.1841,
  "-1.00": 0.1379,
  "-1.01": 0.1401,
  "-1.02": 0.1423,
  "-1.03": 0.1446,
  "-1.04": 0.1469,
  "-1.05": 0.1492,
  "-1.06": 0.1515,
  "-1.07": 0.1539,
  "-1.08": 0.1562,
  "-1.09": 0.1587,
  "-1.10": 0.117,
  "-1.11": 0.119,
  "-1.12": 0.121,
  "-1.13": 0.123,
  "-1.14": 0.1251,
  "-1.15": 0.1271,
  "-1.16": 0.1292,
  "-1.17": 0.1314,
  "-1.18": 0.1335,
  "-1.19": 0.1357,
  "-1.20": 0.0985,
  "-1.21": 0.1003,
  "-1.22": 0.102,
  "-1.23": 0.1038,
  "-1.24": 0.1056,
  "-1.25": 0.1075,
  "-1.26": 0.1093,
  "-1.27": 0.1112,
  "-1.28": 0.1131,
  "-1.29": 0.1151,
  "-1.30": 0.0823,
  "-1.31": 0.0838,
  "-1.32": 0.0853,
  "-1.33": 0.0869,
  "-1.34": 0.0885,
  "-1.35": 0.0901,
  "-1.36": 0.0918,
  "-1.37": 0.0934,
  "-1.38": 0.0951,
  "-1.39": 0.0968,
  "-1.40": 0.0681,
  "-1.41": 0.0694,
  "-1.42": 0.0708,
  "-1.43": 0.0721,
  "-1.44": 0.0735,
  "-1.45": 0.0749,
  "-1.46": 0.0764,
  "-1.47": 0.0778,
  "-1.48": 0.0793,
  "-1.49": 0.0808,
  "-1.50": 0.0559,
  "-1.51": 0.0571,
  "-1.52": 0.0582,
  "-1.53": 0.0594,
  "-1.54": 0.0606,
  "-1.55": 0.0618,
  "-1.56": 0.063,
  "-1.57": 0.0643,
  "-1.58": 0.0655,
  "-1.59": 0.0668,
  "-1.60": 0.0455,
  "-1.61": 0.0465,
  "-1.62": 0.0475,
  "-1.63": 0.0485,
  "-1.64": 0.0495,
  "-1.65": 0.0505,
  "-1.66": 0.0516,
  "-1.67": 0.0526,
  "-1.68": 0.0537,
  "-1.69": 0.0548,
  "-1.70": 0.0367,
  "-1.71": 0.0375,
  "-1.72": 0.0384,
  "-1.73": 0.0392,
  "-1.74": 0.0401,
  "-1.75": 0.0409,
  "-1.76": 0.0418,
  "-1.77": 0.0427,
  "-1.78": 0.0436,
  "-1.79": 0.0446,
  "-1.80": 0.0294,
  "-1.81": 0.0301,
  "-1.82": 0.0307,
  "-1.83": 0.0314,
  "-1.84": 0.0322,
  "-1.85": 0.0329,
  "-1.86": 0.0336,
  "-1.87": 0.0344,
  "-1.88": 0.0351,
  "-1.89": 0.0359,
  "-1.90": 0.0233,
  "-1.91": 0.0239,
  "-1.92": 0.0244,
  "-1.93": 0.025,
  "-1.94": 0.0256,
  "-1.95": 0.0262,
  "-1.96": 0.0268,
  "-1.97": 0.0274,
  "-1.98": 0.0281,
  "-1.99": 0.0287,
  "-2.00": 0.0183,
  "-2.01": 0.0188,
  "-2.02": 0.0192,
  "-2.03": 0.0197,
  "-2.04": 0.0202,
  "-2.05": 0.0207,
  "-2.06": 0.0212,
  "-2.07": 0.0217,
  "-2.08": 0.0222,
  "-2.09": 0.0228,
  "-2.10": 0.0143,
  "-2.11": 0.0146,
  "-2.12": 0.015,
  "-2.13": 0.0154,
  "-2.14": 0.0158,
  "-2.15": 0.0162,
  "-2.16": 0.0166,
  "-2.17": 0.017,
  "-2.18": 0.0174,
  "-2.19": 0.0179,
  "-2.20": 0.011,
  "-2.21": 0.0113,
  "-2.22": 0.0116,
  "-2.23": 0.0119,
  "-2.24": 0.0122,
  "-2.25": 0.0125,
  "-2.26": 0.0129,
  "-2.27": 0.0132,
  "-2.28": 0.0136,
  "-2.29": 0.0139,
  "-2.30": 0.0084,
  "-2.31": 0.0087,
  "-2.32": 0.0089,
  "-2.33": 0.0091,
  "-2.34": 0.0094,
  "-2.35": 0.0096,
  "-2.36": 0.0099,
  "-2.37": 0.0102,
  "-2.38": 0.0104,
  "-2.39": 0.0107,
  "-2.40": 0.0064,
  "-2.41": 0.0066,
  "-2.42": 0.0068,
  "-2.43": 0.0069,
  "-2.44": 0.0071,
  "-2.45": 0.0073,
  "-2.46": 0.0075,
  "-2.47": 0.0078,
  "-2.48": 0.008,
  "-2.49": 0.0082,
  "-2.50": 0.0048,
  "-2.51": 0.0049,
  "-2.52": 0.0051,
  "-2.53": 0.0052,
  "-2.54": 0.0054,
  "-2.55": 0.0055,
  "-2.56": 0.0057,
  "-2.57": 0.0059,
  "-2.58": 0.006,
  "-2.59": 0.0062,
  "-2.60": 0.0036,
  "-2.61": 0.0037,
  "-2.62": 0.0038,
  "-2.63": 0.0039,
  "-2.64": 0.004,
  "-2.65": 0.0041,
  "-2.66": 0.0043,
  "-2.67": 0.0044,
  "-2.68": 0.0045,
  "-2.69": 0.0047,
  "-2.70": 0.0026,
  "-2.71": 0.0027,
  "-2.72": 0.0028,
  "-2.73": 0.0029,
  "-2.74": 0.003,
  "-2.75": 0.0031,
  "-2.76": 0.0032,
  "-2.77": 0.0033,
  "-2.78": 0.0034,
  "-2.79": 0.0035,
  "-2.80": 0.0019,
  "-2.81": 0.002,
  "-2.82": 0.0021,
  "-2.83": 0.0021,
  "-2.84": 0.0022,
  "-2.85": 0.0023,
  "-2.86": 0.0023,
  "-2.87": 0.0024,
  "-2.88": 0.0025,
  "-2.89": 0.0026,
  "-2.90": 0.0014,
  "-2.91": 0.0014,
  "-2.92": 0.0015,
  "-2.93": 0.0015,
  "-2.94": 0.0016,
  "-2.95": 0.0016,
  "-2.96": 0.0017,
  "-2.97": 0.0018,
  "-2.98": 0.0018,
  "-2.99": 0.0019,
  "-3.00": 0.001,
  "-3.01": 0.001,
  "-3.02": 0.0011,
  "-3.03": 0.0011,
  "-3.04": 0.0011,
  "-3.05": 0.0012,
  "-3.06": 0.0012,
  "-3.07": 0.0013,
  "-3.08": 0.0013,
  "-3.09": 0.0013,
  "-3.10": 0.0007,
  "-3.11": 0.0007,
  "-3.12": 0.0008,
  "-3.13": 0.0008,
  "-3.14": 0.0008,
  "-3.15": 0.0008,
  "-3.16": 0.0009,
  "-3.17": 0.0009,
  "-3.18": 0.0009,
  "-3.19": 0.001,
  "-3.20": 0.0005,
  "-3.21": 0.0005,
  "-3.22": 0.0005,
  "-3.23": 0.0006,
  "-3.24": 0.0006,
  "-3.25": 0.0006,
  "-3.26": 0.0006,
  "-3.27": 0.0006,
  "-3.28": 0.0007,
  "-3.29": 0.0007,
  "-3.30": 0.0003,
  "-3.31": 0.0004,
  "-3.32": 0.0004,
  "-3.33": 0.0004,
  "-3.34": 0.0004,
  "-3.35": 0.0004,
  "-3.36": 0.0004,
  "-3.37": 0.0005,
  "-3.38": 0.0005,
  "-3.39": 0.0005,
  "-3.40": 0.0002,
  "-3.41": 0.0003,
  "-3.42": 0.0003,
  "-3.43": 0.0003,
  "-3.44": 0.0003,
  "-3.45": 0.0003,
  "-3.46": 0.0003,
  "-3.47": 0.0003,
  "-3.48": 0.0003,
  "-3.49": 0.0003,
  "0.00": 0.5000
}
