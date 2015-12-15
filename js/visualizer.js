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

const COLORS = d3.scale.linear()
  .domain([0, 1])
  .range(["black", "#cedb9c"]);

const DONUT_COLORS = ["#E5947E", "#933652", "#EBF5FF"];

// Load the hospital data. When the data comes back, create an overlay.
d3.json("hospitalData.json", (data) => {
  var overlay = new google.maps.OverlayView();

  // Add the container when the overlay is added to the map.
  overlay.onAdd = function() {
    //var layer = d3.select(this.getPanes().overlayLayer).append("div")
    //    .attr("class", "hospitals");
    var layer = d3.select(this.getPanes().overlayMouseTarget).append("div").attr("class", "hospitals");

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
          fill: d => COLORS(evaluateCriteria(d.value)),
          id: d => d.key,
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
        .on("click", d => showDetails(d.value));


      function transform(d) {
        // If we don't have lat long, get from address.
        if(d.value["Lat"] === ""){
          console.log(d);
          var geocoder = new google.maps.Geocoder();
          const address = d.value["Address"]["StreetAddress"] + d.value["Address"]["City"] + d.value["Address"]["State"] + d.value["Address"]["ZIP"]
          geocoder.geocode({'address': address}, function(results, status) {
            if (status === google.maps.GeocoderStatus.OK) {
              console.log(results[0].geometry.location)
            } else {
              alert('Geocode was not successful for the following reason: ' + status);
            }
          });
        }
        
        d = new google.maps.LatLng(d.value["Lat"], d.value["Long"]);
        d = projection.fromLatLngToDivPixel(d);
        return d3.select(this)
            .style("left", (d.x - padding) + "px")
            .style("top", (d.y - padding) + "px");
      }

      // function codeAddress(address) {
      //   //return lat, long for hospital address
      //   geocoder.geocode( { 'address': address}, function(results, status) {
      //     if (status == google.maps.GeocoderStatus.OK) {
      //       map.setCenter(results[0].geometry.location);
      //       var marker = new google.maps.Marker({
      //           map: map,
      //           position: results[0].geometry.location
      //       });
      //     } else {
      //       alert("Geocode was not successful for the following reason: " + status);
      //     }
      //   });
      // }
    };
  };

  // Bind our overlay to the map…
  overlay.setMap(map);
});

const hospitalCriteria = [
  {
    name: "Comfort",
    weight: 1.0,
    maxValue: 1,
    value: d => evaluateCriteria(d["StarRatings"], [
      {
        // An individual question example: currently deactivated by its 0 weight
        name: "Cleanliness",
        weight: 1.0,
        maxValue: 5,
        value: d => d["H_CLEAN_STAR_RATING"],
      },
      {
        name: "Overall Rating",
        weight: 1.0,
        maxValue: 5,
        value: d => d["H_STAR_RATING"],
      },
    ]),
  },
];

//fake data -- to be replaced with Criteria class stuff
const donutData = [
  {
    name: "Comfort",
    weight: 1.0,
    normalizedValue: .5,
  },
  {
    name: "Affordability",
    weight: 1.0,
    normalizedValue: .5,
  },
  {
    name: "Quality",
    weight: 1.0,
    normalizedValue: .5,
  }
];
/**
 * Given a datum and an array of criteria, evaluate the overall scoring of a
 * hospital based on the criteria, accounting for weighting. Note that
 *
 * Criteria should be of the form:
 * [
 * 	{
 * 		name: String,
 * 		weight: Number,
 * 		maxValue: Number,
 * 		value: Function(datum) => Number,
 * 	}, ...
 * ]
 *
 * @param  {Object} datum    A hospital datum
 * @param  {Array} criteria  An array of objects of the form described above
 * @return {Number}          A 0-1 scoring of a hospital, based on the critera
 */
function evaluateCriteria(datum, criteria=hospitalCriteria, verbose=false) {
  // Short circuit if the data is evaluated
  if (datum === undefined) return 0;

  let weightsSum = 0;
  let weightedValueSum = 0;

  // Calculate the weighted sum of the criteria and keep
  // track of the weights so that the value can be normalized
  // from 0-1 later
  criteria.forEach((c) => {
    // Short circuit the for loop if the data cannot be cast
    if(isNaN(c.value(datum))) return 0;

    weightedValueSum += (c.value(datum) / c.maxValue) * c.weight;
    weightsSum += c.weight;
  });

  // Optionally display console output for debugging
  if (verbose) {
    console.log(datum)
    console.log("weightedValueSum: ", weightedValueSum)
    console.log("weightSum: ", weightsSum)
    console.log("value: ", weightedValueSum / weightsSum)
    console.log("---")
  }

  // Normalize the weighted sum of the values from 0-1 and return
  return weightedValueSum / weightsSum;
}

function showDetails(hospitalDatum, criteria) {
  const sidebar = d3.select('#detailSidebar');
  sidebar.classed('show', true);

  addDonutChart('#hospitalDonut', hospitalDatum, criteria);

  d3.select('#hospitalNameField')
    .text(hospitalDatum['Hospital'].toLowerCase());

  const { Address } = hospitalDatum;

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
  svg.attr("height", width); //make SVG square

  // Center donut viz in square SVG
  const viz = svg.append("g")
    .attr("transform", `translate( ${width/2}, ${width/2})`);

  const maxRadius = 0.4 * width;
  const minRadius = 0.2 * width;
  const textRadius = maxRadius + 20; // padding = 20

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
    .innerRadius(minRadius);  // outerRadius to change w/ data

  const labelArc = d3.svg.arc()
    .outerRadius(textRadius)
    .innerRadius(textRadius);

  const pie = d3.layout.pie()
    .sort(null)
    .value(d => d.weight);

  const g = viz.selectAll(".arc")
    .data(pie(donutData))
    .enter()
    .append("g")
    .attr("class", "arc");

  const radiusScale = d3.scale.linear()
    .domain([0, 1])
    .range([minRadius, maxRadius]);

  g.append("path")
    .each(d => { d.outerRadius = radiusScale(d.data.normalizedValue); })
    .attr("d", arc)
    .style("fill", (d, i) =>  DONUT_COLORS[i]);

  g.append("text")
    .attr("transform", d => `translate( ${labelArc.centroid(d)})`)
    .attr("dy", ".35em")
    .attr("text-anchor", "middle")
    .text(d => d.data.name);
}
