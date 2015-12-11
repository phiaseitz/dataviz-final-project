// Create the Google Map…
var map = new google.maps.Map(d3.select("#map").node(), {
  zoom: 4,
  center: new google.maps.LatLng(39.828215,-98.5817593),
  mapTypeId: google.maps.MapTypeId.ROADMAP
});

var styles = [
  //This colors the land.
  {
    featureType: "landscape",
    elementType: "all",
    stylers: [
      {
        hue: "#669999"
      },
      {
        saturation: -10
      },
      {
        lightness: 0
      },
      {
        visibility: "simplified"
      }
    ]
  },
  //Points of interest are parks and stuff.
  //We can turn this off
  {
    featureType: "poi",
    elementType: "all",
    stylers: [
      {
        hue: "#ffffff"
      },
      {
        saturation: -100
      },
      {
        lightness: 100
      },
      {
        visibility: "off"
      }
    ]
  },
  //the roads themselves
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [
      {
        hue: "#bbc0c4"
      },
      {
        saturation: -93
      },
      {
        lightness: 31
      },
      {
        visibility: "simplified"
      },
      {
        weight: 2
      }
    ]
  },
  //The road labels
  {
    featureType: "road",
    elementType: "labels",
    stylers: [
      {
        hue: "#bbc0c4"
      },
      {
        saturation: -93
      },
      {
        lightness: 31
      },
      {
        visibility: "simplified"
      }
    ]
  },
  {
    featureType: "road.arterial",
    elementType: "labels",
    stylers: [
      {
        hue: "#bbc0c4"
      },
      {
        saturation: -93
      },
      {
        lightness: -2
      },
      {
        visibility: "simplified"
      }
    ]
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [
      {
        hue: "#e9ebed"
      },
      {
        saturation: -90
      },
      {
        lightness: -8
      },
      {
        visibility: "simplified"
      }
    ]
  },
  {
    featureType: "transit",
    elementType: "all",
    stylers: [
      {
        hue: "#e9ebed"
      },
      {
        saturation: 10
      },
      {
        lightness: 69
      },
      { 
        visibility: "on"
      }
    ]
  },
  //This changes the color of the water
  {
    featureType: "water",
    elementType: "all",
    stylers: [
      {
        hue: "#6699ff"
      },
      {
        saturation: 100
      },
      {
        lightness: 20
      },
      {
        visibility: "simplified"
      }
    ]
  }
];

map.setOptions({styles: styles});

// Load the station data. When the data comes back, create an overlay.
d3.csv("csv_data.csv", function(data) {
  var overlay = new google.maps.OverlayView();

  // Add the container when the overlay is added to the map.
  overlay.onAdd = function() {
    var layer = d3.select(this.getPanes().overlayLayer).append("div")
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
          .attr("r", 4.5)
          .attr("cx", padding)
          .attr("cy", padding);

      // Add a label.
      marker.append("svg:text")
          .attr("x", padding + 7)
          .attr("y", padding)
          .attr("dy", ".31em")
          .text(function(d) { return d.key; });

      function transform(d) {
        d = new google.maps.LatLng(d.value[1], d.value[0]);
        d = projection.fromLatLngToDivPixel(d);
        return d3.select(this)
            .style("left", (d.x - padding) + "px")
            .style("top", (d.y - padding) + "px");
      }

      function codeAddress(address) {
        //return lat, long for hospital address
        geocoder.geocode( { 'address': address}, function(results, status) {
          if (status == google.maps.GeocoderStatus.OK) {
            map.setCenter(results[0].geometry.location);
            var marker = new google.maps.Marker({
                map: map,
                position: results[0].geometry.location
            });
          } else {
            alert("Geocode was not successful for the following reason: " + status);
          }
        });
      }
    };
  };

  // Bind our overlay to the map…
  overlay.setMap(map);
});