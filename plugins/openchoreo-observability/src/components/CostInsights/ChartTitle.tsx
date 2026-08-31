import { FC } from 'react';
import { Tooltip, Typography, makeStyles } from '@material-ui/core';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
  },
  icon: {
    fontSize: 16,
    color: theme.palette.text.secondary,
    cursor: 'help',
  },
}));

export interface ChartTitleProps {
  title: string;
  info: string;
  className?: string;
}

export const ChartTitle: FC<ChartTitleProps> = ({ title, info, className }) => {
  const classes = useStyles();
  return (
    <div className={`${classes.root} ${className ?? ''}`.trim()}>
      <Typography variant="subtitle2">{title}</Typography>
      <Tooltip title={info} arrow>
        <InfoOutlinedIcon className={classes.icon} />
      </Tooltip>
    </div>
  );
};
