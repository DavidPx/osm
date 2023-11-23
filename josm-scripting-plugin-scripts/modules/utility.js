const Geometry = Java.type('org.openstreetmap.josm.tools.Geometry');
import * as console from 'josm/scriptingconsole'
const ProjectionRegistry = Java.type('org.openstreetmap.josm.data.projection.ProjectionRegistry');
const Node = Java.type("org.openstreetmap.josm.data.osm.Node");

const ArrayList = Java.type('java.util.ArrayList');

const streetPrefixes = new Map();
streetPrefixes.set('W', 'West');
streetPrefixes.set('E', 'East');
streetPrefixes.set('N', 'North');
streetPrefixes.set('S', 'South');

export const lookupPrefix = x => {
	if (streetPrefixes.has(x)) return streetPrefixes.get(x);
	return null;
};

// Creates a Java ArrayList from a JS array
export const toArrayList = x => {
    const list = new ArrayList();
    x.forEach(o => list.add(o));
    return list;
}

// see which of the test ways contains the way's centroid
// returns a Way or null if none contain the center
export const findContainingWay = (way, waysToTest) => {
    
    const wayCentroidEN = Geometry.getCentroid(way.getNodes()); // returns EastNorth
    let returnWay = null;

    for(const tw of waysToTest) {
        const areaEN = Geometry.getAreaEastNorth(tw);

        if (areaEN.contains(wayCentroidEN.east(), wayCentroidEN.north())) {
            returnWay = tw;
            break;
        }
    }

    return returnWay;
}

export const getPrimitiveTagsAsObject = (primitive) => {
    const tags = {};
    primitive.getKeys().entrySet().forEach(x => {
        tags[x.getKey()] = x.getValue();
        });
    return tags;
}

/*
    Returns Nodes where the given way intersects the given EastNorth segment
*/
export const getSegmentWayIntersections = (way, en1, en2) => {
    const pairs = way.getNodePairs(false);
    const projection = ProjectionRegistry.getProjection();

    return pairs.reduce((acc, pair) => {
        const enA = pair.a.getEastNorth(projection);
        const enB = pair.b.getEastNorth(projection);

        const resultEN = Geometry.getSegmentSegmentIntersection(en1, en2, enA, enB);

        if (resultEN) {
            acc.push(new Node(resultEN));
        }
        return acc;
    }, []);
}

let t = Date.now();
export const printElapsed = (msg) => {
	const z = Date.now();
	console.println(`${z - t}ms\t${msg}`);
	t = z;
}