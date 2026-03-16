import { lazy, Suspense, useEffect, useState } from 'react';
import { Progress } from '@backstage/core-components';
import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { Project } from '@wso2/cell-diagram';

const CellView = lazy(() =>
  import('@wso2/cell-diagram').then(module => ({
    default: module.CellDiagram,
  })),
);

const useStyles = makeStyles(theme => ({
  cellDiagramWrapper: {
    height: 'calc(100vh - 146px)',
    width: 'calc(100% + 48px)',
    margin: '-24px -24px -24px -24px',
    // Single dot pattern layer matching Platform Overview
    backgroundImage:
      theme.palette.type === 'dark'
        ? 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)'
        : 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    // Strip library dot pattern from all descendant divs (no node uses backgroundImage)
    '& div': {
      backgroundImage: 'none !important',
    },
    // Clear container-level white backgrounds only (depths 1-3)
    // These are Container (Diagram.js), Container/PromptScreen (ProjectDiagram.js), DiagramContainer
    '& > div, & > div > div, & > div > div > div': {
      backgroundColor: 'transparent !important',
    },
  },
}));

export const CellDiagram = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const [cellDiagramData, setCellDiagramData] = useState<Project>();
  const client = useApi(openChoreoClientApiRef);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await client.getCellDiagramInfo(entity);
        setCellDiagramData(data as Project);
      } catch (error) {
        // Error handling could be added here if needed
      }
    };

    fetchData();
  }, [entity, client]);

  return (
    <Box className={classes.cellDiagramWrapper}>
      <Suspense fallback={<Progress />}>
        <CellView project={cellDiagramData} />
      </Suspense>
    </Box>
  );
};
