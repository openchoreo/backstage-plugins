import { PortModelAlignment } from '@projectstorm/react-diagrams';

export function getOpposingPort(currentPortID: string, port: PortModelAlignment): string {
    if (port === PortModelAlignment.LEFT) {
        return currentPortID.replace(PortModelAlignment.RIGHT, PortModelAlignment.LEFT);
    } else if (port === PortModelAlignment.RIGHT) {
        return currentPortID.replace(PortModelAlignment.LEFT, PortModelAlignment.RIGHT);
    } else if (port === PortModelAlignment.TOP) {
        return currentPortID.replace(PortModelAlignment.BOTTOM, PortModelAlignment.TOP);
    } 
        return currentPortID.replace(PortModelAlignment.TOP, PortModelAlignment.BOTTOM);
    
}
