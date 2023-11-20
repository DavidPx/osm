import josm from 'josm'
import * as console from 'josm/scriptingconsole'

const activeLayer = josm.layers.activeLayer;

const activeDataSet = activeLayer.getDataSet();
const selectedBuildings = activeDataSet.getAllSelected().toArray();

const prim = selectedBuildings[0];

console.println(`ID: ${prim.getId()}`);
