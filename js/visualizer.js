// Create the Google Map…
var map = new google.maps.Map(d3.select("#map").node(), {
  zoom: 5,
  center: new google.maps.LatLng(39.828215,-98.5817593),
  mapTypeId: google.maps.MapTypeId.HYBRID
});

const COLORS = d3.scale.linear()
  .domain([0, 1])
  .range(["black", "#cedb9c"]);

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
            r: 4.5,
            cx: padding,
            cy: padding,
            fill: d => COLORS(evaluateCriteria(d.value, hospitalCriteria)),
            id: d => d.key,
          })
          .on("mouseenter", function(){return d3.select("#tip"+d3.select(this).attr("id")).style("visibility", "visible");})
          .on("mouseleave", function(){return d3.select("#tip"+d3.select(this).attr("id")).style("visibility", "hidden");});

      // Add a label.
      var tooltip = marker.append("svg:text")
          .attr("x", padding + 7)
          .attr("y", padding)
          .attr("dy", ".31em")
          .attr("id", function(d){return "tip"+ d.key;})
          .style("background", "white")
          .style("font-weight","bold")
          .style("visibility", "hidden")
          .text(function(d) { return d.value["Hospital"]; });


      function transform(d) {
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
        weight: 0,
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
