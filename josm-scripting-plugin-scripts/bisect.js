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
const OsmPrimitiveType = Java.type('org.openstreetmap.josm.data.osm.OsmPrimitiveType');
const ProjectionRegistry = Java.type('org.openstreetmap.josm.data.projection.ProjectionRegistry');
import {
    buildAddCommand,
    buildChangeCommand
} from 'josm/command'
import { WayBuilder } from 'josm/builder';
import { getPrimitiveTagsAsObject, getSegmentWayIntersections } from 'utility';

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

    // OSM buildings are pretty angular so we're not going to get buildings with a wide variety of angles.
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

    // this crossing line is horizontal (0 + 90) so we only need to rotate by the winning angle (from 0 north) to get a perpendicular line.
    const end1 = centroidEN.add(150, 0).rotate(centroidEN, winningBucket.angleAverage);
    const end2 = centroidEN.add(-150, 0).rotate(centroidEN, winningBucket.angleAverage);

    const intersectionNodes = getSegmentWayIntersections(way, end1, end2);
    buildAddCommand(intersectionNodes).applyTo(activeLayer);

    // make a new list of nodes so we can use the change command; it needs all the nodes not just the modified ones.
    const wayNodes = way.getNodes();
    
	let spliceCount = 0;
    for (const node of intersectionNodes) {
        const ws = Geometry.getClosestWaySegment(way, node);
        wayNodes.splice(ws.getUpperIndex() + spliceCount++, 0, node);
    }

    // now split the way in twain.  Move some nodes to the destination and copy the intersection
    const originalNodes = []
    const destNodes = [];

    let moveNode = false;
    for (const node of wayNodes) {
        // copy the intersection nodes
        // start moving after we've hit one intersection node and stop after we've hit the other
        if (intersectionNodes.some(x => x === node)) {
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

    buildChangeCommand(way, { nodes: originalNodes }).applyTo(activeLayer);
    buildAddCommand(
	    WayBuilder
	        .forDataSet(activeDataSet)
	        .withNodes(destNodes)
	        .withTags(getPrimitiveTagsAsObject(way))
	        .create()).applyTo(activeLayer);

    console.println(`way ${way.getId()} split!`);
}
