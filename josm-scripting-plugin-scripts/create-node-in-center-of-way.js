import josm from 'josm'
import { DataSetUtil } from 'josm/ds'
import {printElapsed} from 'utility';
import {buildAddCommand} from 'josm/command'
const Node = Java.type('org.openstreetmap.josm.data.osm.Node');
const Geometry = Java.type('org.openstreetmap.josm.tools.Geometry');

const activeLayer = josm.layers.activeLayer;

const activeDataSet = activeLayer.getDataSet();
const selectedBuildings = activeDataSet.getAllSelected().toArray();

for (const building of selectedBuildings) {
    const wayCentroidEN = Geometry.getCentroid(building.getNodes()); // returns EastNorth


    buildAddCommand(new Node(wayCentroidEN)).applyTo(activeLayer);
}
