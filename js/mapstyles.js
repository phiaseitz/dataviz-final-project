var styles = [
  //This colors the land.
  { featureType: "landscape",
    elementType: "all",
    stylers: [
      {hue: "#669999"},
      {saturation: -10},
      {lightness: 90},
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
