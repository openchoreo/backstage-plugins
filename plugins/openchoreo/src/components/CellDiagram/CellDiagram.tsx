import { lazy, Suspense, useEffect, useState } from 'react';
import { Progress } from '@backstage/core-components';
import Box from '@material-ui/core/Box';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { Project } from '@wso2/cell-diagram';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';

const CellView = lazy(() =>
  import('@wso2/cell-diagram').then(module => ({
    default: module.CellDiagram,
  })),
);

export const CellDiagram = () => {
  const { entity } = useEntity();
  const [cellDiagramData, setCellDiagramData] = useState<Project>();
  const client = useApi(openChoreoClientApiRef);
  const { mode } = useChoreoTokens();

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

  // Don't render `<CellView>` until `cellDiagramData` is loaded — the
  // library paints a canvas on first render even when `project` is
  // undefined, which can flash through briefly before data arrives.
  return (
    <Box
      sx={{
        height: 'calc(100vh - 146px)',
        width: 'calc(100% + 48px)',
        margin: '-24px -24px -24px -24px',
        bgcolor: 'background.default',
        color: 'text.primary',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {cellDiagramData ? (
        <Suspense fallback={<Progress />}>
          <CellView project={cellDiagramData} mode={mode} />
        </Suspense>
      ) : (
        <Progress />
      )}
    </Box>
  );
};
