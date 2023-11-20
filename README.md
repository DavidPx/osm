# osm
OSM stuff by Dave.

## JOSM Plugin Scripts
[See More](./josm-scripting-plugin-scripts/readme.md)
## ArcGIS Parcel Fetcher
[See More](./arcgis-parcel-fetcher/readme.md)
## Shapefile Conversion Notes
My state offers statewide parcel data but only in a ShapeFile format.  Here's how I got it it a JOSM-friendly format.

1. Download shapefile zip file from https://maps.sco.wisc.edu/Parcels/.  Use the county-level downloads.
1. [Map Shaper](https://mapshaper.org/) UI Steps
    1. Upload the zip
    1. In its console run `proj wgs84`.  The original file is in the EPSG:3071 format which JOSM does not support
    1. Export to a GeoJSON file (might need to rename the extension to .geojson)
1. Map Shaper Console alternative
    1. mapshaper .\V900_Wisconsin_Parcels_OZAUKEE_SHP.zip -proj wgs84 -o format=geojson foo.geojson
