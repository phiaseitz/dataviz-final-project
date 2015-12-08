// Create the Google Map…
var map = new google.maps.Map(d3.select("#map").node(), {
  zoom: 5,
  center: new google.maps.LatLng(39.828215,-98.5817593),
  mapTypeId: google.maps.MapTypeId.HYBRID
});

// Load the station data. When the data comes back, create an overlay.
d3.json("hospitalData.json", function(data) {
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
          .attr("r", 4.5)
          .attr("cx", padding)
          .attr("cy", padding)
          .attr("id", function(d){return d.key;})
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
