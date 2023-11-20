/*
    This script seeks to help cutting buildings in half along their long axis.

    ---------------------
    -                   -
    -                   -
    ---------------------

    Would get turned into:

    ---------------------
    -         -         -
    -         -         -
    ---------------------

    1. Select Building
    2. Run Script

    Tags from the original building are copied to the new way.

    Graal setup - add this repo's modules directory as a module search path.

*/
import josm from 'josm'
import * as console from 'josm/scriptingconsole'
const Geometry = Java.type('org.openstreetmap.josm.tools.Geometry');
const Node = Java.type("org.openstreetmap.josm.data.osm.Node");
const Way = Java.type("org.openstreetmap.josm.data.osm.Way");
const OsmPrimitiveType = Java.type('org.openstreetmap.josm.data.osm.OsmPrimitiveType');
const ProjectionRegistry = Java.type('org.openstreetmap.josm.data.projection.ProjectionRegistry');
import {
    buildAddCommand,
    buildChangeCommand
} from 'josm/command'
import { WayBuilder } from 'josm/builder';
import { getPrimitiveTagsAsObject } from 'utility';

const radToDegree = (r) => r * 180 / Math.PI; // handy for debugging
const OneEightyDegreesInRadians = Math.PI;

console.clear();
const projection = ProjectionRegistry.getProjection();
const activeLayer = josm.layers.activeLayer;

const activeDataSet = activeLayer.getDataSet();

const selectedPrimitives = activeDataSet.getAllSelected().toArray();

const buildingsToTouch = selectedPrimitives.filter(x => x.getType() == OsmPrimitiveType.WAY && x.isClosed());

activeDataSet.clearSelection();

for (const way of buildingsToTouch) {

    // Collect the heading angle and length of each way segment
	  // headings are based on 0 degrees North and are always positive, (0 to 360), in a clockwise direction.
    const data = [];
    const pairs = way.getNodePairs(false);

    for (const pair of pairs) {

        const enA = pair.a.getEastNorth(projection);
        const enB = pair.b.getEastNorth(projection);

        let headingRadians = enA.heading(enB);
				// we don't care which direction the way is, just its slope.  Normalize to 0 to 180.
        if (headingRadians > OneEightyDegreesInRadians) headingRadians -= OneEightyDegreesInRadians;

        data.push({
            angle: headingRadians,
            length: enA.distance(enB),
        });
    }

    // OSB buildings are pretty angular so we're not going to get buildings with a wide variety of angles.
    // If a given angle is +- a few degrees from the bucket include it
    // If a building is being troublesome straighten it out with ctrl+q (orthoganalize)
    const angleFudge = 1.5 * Math.PI / 180;
    const stats = data.reduce((acc, curr) => {
        const bucket = acc.find(x => x.angleAverage > curr.angle - angleFudge && x.angleAverage < curr.angle + angleFudge);
        if (!bucket) {
            acc.push({
                totalAngle: curr.angle,
                angleAverage: curr.angle,
                totalLength: curr.length,
                count: 1
            });
        }
        else {
            bucket.count++;
            bucket.totalLength += curr.length;
            bucket.totalAngle += curr.angle;
            // keep a running average of the angle
            bucket.angleAverage = bucket.totalAngle / bucket.count;
        }
        return acc;
    }, []);

    const winningBucket = stats.reduce((acc, curr) => {
        if (curr.totalLength > acc.totalLength) return curr;
        return acc;
    });

    // center of building
    const centroidEN = Geometry.getCentroid(way.getNodes());

    // make a dummy crossing way so that we can run the handy intersect function
	  const end1 = centroidEN.add(150, 0);
    const end2 = centroidEN.add(-150, 0);

	  // this crossing line is horizontal (0 + 90) so we only need to rotate by the winning angle (from 0 north) to get a perpendicular line.
    const end1final = end1.rotate(centroidEN, winningBucket.angleAverage);
    const end2final = end2.rotate(centroidEN, winningBucket.angleAverage);

    const n1 = new Node(end1final);
    const n2 = new Node(end2final);

		// TODO: look into using Geometry.getSegmentSegmentIntersection computing the crossing points intead of the dummy way.
	  // https://josm.openstreetmap.de/doc/org/openstreetmap/josm/tools/Geometry.html#getSegmentSegmentIntersection-org.openstreetmap.josm.data.coor.EastNorth-org.openstreetmap.josm.data.coor.EastNorth-org.openstreetmap.josm.data.coor.EastNorth-org.openstreetmap.josm.data.coor.EastNorth-
    const bisectWay = new Way();

    bisectWay.addNode(n1);
    bisectWay.addNode(n2);

    buildAddCommand(n1, n2, bisectWay).applyTo(activeLayer);

    // TODO: look into the add commands this can populate
    const intersections = Geometry.addIntersections([bisectWay, way], false, []).toArray();

    buildAddCommand(intersections).applyTo(activeLayer);

    for (const node of intersections) {
        const ws = Geometry.getClosestWaySegment(way, node);
        // TODO: make this node addition undoable.  If the above intersection addition command is undone the way will be left with non-existent nodes and JOSM will get crashy around that way.
        // One can at least restore the way by selected it and then doing File > Update Selection.
        way.addNode(ws.getUpperIndex(), node);
    }

    // remove the working way
    activeDataSet.removePrimitives([bisectWay, n1, n2]);

    // now split the way in twain.  Move some nodes to the destination and copy the intersection
    const originalNodes = []
    const destNodes = [];

    let moveNode = false;
    for (const node of way.getNodes()) {
        // copy the intersection nodes
        // start moving after we've hit one intersection node and stop after we've hit the other
        if (intersections.some(x => x === node)) {
            moveNode = !moveNode;
            // always copy intersection nodes
            originalNodes.push(node);
            destNodes.push(node);
        }
        else if (moveNode) {
            destNodes.push(node);
        }
        else {
            originalNodes.push(node);
        }
    }

    // add the first onto the back.  The original way will already have this feature
    destNodes.push(destNodes[0]);

    //buildAddCommand()
    buildChangeCommand(way, { nodes: originalNodes }).applyTo(activeLayer);
    WayBuilder
        .forDataSet(activeDataSet)
        .withNodes(destNodes)
        .withTags(getPrimitiveTagsAsObject(way))
        .create();

    console.println(`way ${way.getId()} split!`);
}
