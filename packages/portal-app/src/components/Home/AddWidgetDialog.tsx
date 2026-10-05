/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useMemo, useState } from 'react';
import { Widget } from './types';
import Box from '@material-ui/core/Box';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Typography from '@material-ui/core/Typography';
import ButtonBase from '@material-ui/core/ButtonBase';
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import SearchIcon from '@material-ui/icons/Search';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { homeTranslationRef } from './translation';

interface AddWidgetDialogProps {
  widgets: Widget[];
  handleAdd: (widget: Widget) => void;
}

const getTitle = (widget: Widget) => {
  return widget.title || widget.name;
};

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    grid: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: theme.spacing(2),
      maxHeight: '60vh',
      overflowY: 'auto',
      padding: theme.spacing(0.5),
    },
    card: {
      flex: `0 0 calc((100% - ${theme.spacing(2) * 2}px) / 3)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      borderRadius: theme.spacing(1),
      border: `1px solid ${theme.palette.divider}`,
      overflow: 'hidden',
      textAlign: 'left',
      transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      '&:hover': {
        boxShadow: theme.shadows[4],
        transform: 'translateY(-2px)',
      },
      '&:hover $addOverlay': {
        opacity: 1,
      },
    },
    previewFrame: {
      position: 'relative',
      height: 160,
      overflow: 'hidden',
      backgroundColor: theme.palette.background.default,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    previewScale: {
      position: 'absolute',
      top: 0,
      left: '50%',
      width: '166%',
      height: '166%',
      transform: 'translate(-50%, 0) scale(0.6)',
      transformOrigin: 'top center',
    },
    clickBlocker: {
      position: 'absolute',
      inset: 0,
    },
    addOverlay: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      color: theme.palette.common.white,
      opacity: 0,
      transition: 'opacity 0.15s ease',
      fontWeight: 600,
    },
    meta: {
      padding: theme.spacing(1.5),
    },
    searchField: {
      marginBottom: theme.spacing(2),
    },
  }),
);

export const AddWidgetDialog = (props: AddWidgetDialogProps) => {
  const { widgets, handleAdd } = props;
  const { t } = useTranslationRef(homeTranslationRef);
  const classes = useStyles();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWidgets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return widgets;
    }
    return widgets.filter(widget => {
      const title = getTitle(widget).toLowerCase();
      const description = (widget.description ?? '').toLowerCase();
      return title.includes(query) || description.includes(query);
    });
  }, [widgets, searchQuery]);

  return (
    <>
      <DialogTitle>{t('addWidgetDialog.title')}</DialogTitle>
      <DialogContent>
        {widgets.length === 0 ? (
          <Box pb={3} textAlign="center">
            <Typography variant="body1" color="textSecondary">
              {t('addWidgetDialog.noAvailableWidgets')}
            </Typography>
          </Box>
        ) : (
          <>
            <TextField
              className={classes.searchField}
              fullWidth
              variant="outlined"
              size="small"
              placeholder={t('addWidgetDialog.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            {filteredWidgets.length === 0 ? (
              <Box pb={3} textAlign="center">
                <Typography variant="body1" color="textSecondary">
                  {t('addWidgetDialog.noMatchingWidgets')}
                </Typography>
              </Box>
            ) : (
              <div className={classes.grid}>
                {filteredWidgets.map(widget => (
                  <ButtonBase
                    key={widget.name}
                    className={classes.card}
                    onClick={() => handleAdd(widget)}
                    focusRipple
                  >
                    <div className={classes.previewFrame}>
                      <div className={classes.previewScale}>
                        {widget.component}
                      </div>
                      <div className={classes.clickBlocker} />
                      <div className={classes.addOverlay}>
                        <Typography variant="button" style={{ color: '#fff' }}>
                          + {t('addWidgetDialog.title')}
                        </Typography>
                      </div>
                    </div>
                    <div className={classes.meta}>
                      <Typography variant="subtitle2" color="textPrimary">
                        {getTitle(widget)}
                      </Typography>
                      {widget.description && (
                        <Typography variant="caption" color="textSecondary">
                          {widget.description}
                        </Typography>
                      )}
                    </div>
                  </ButtonBase>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </>
  );
};
