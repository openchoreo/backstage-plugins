import { Component } from 'react';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import CircularProgress from '@mui/material/CircularProgress';
import styled from '@emotion/styled';

import { OverlayLayerModel } from './OverlayLayerModel';
import { Colors } from '../../resources';

export interface NodeLayerWidgetProps {
	layer: OverlayLayerModel;
	engine: DiagramEngine;
}

const Container = styled.div`
	display: flex;
	align-items: center;
	flex-direction: row;
	justify-content: center;
	height: 100%;
	width: 100%;
	background-image: radial-gradient(${({ theme }) => theme.colors.SURFACE_CONTAINER} 10%, transparent 0px);
    background-size: 16px 16px;
    background-color: ${({ theme }) => theme.colors.SURFACE_BRIGHT};
`;

export class OverlayLayerWidget extends Component<NodeLayerWidgetProps> {
    render() {
        return (
            <Container>
                <CircularProgress sx={{ color: Colors.PRIMARY }} />
            </Container>
        );
    }
}
