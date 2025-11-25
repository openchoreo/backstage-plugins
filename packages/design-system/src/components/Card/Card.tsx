import React from 'react';
import { Card as MuiCard, CardProps as MuiCardProps } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  card: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: theme.shape.borderRadius,
  },
  interactive: {
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      boxShadow: theme.shadows[3],
      transform: 'translateY(-2px)',
    },
  },
  bordered: {
    border: `1px solid ${theme.palette.divider}`,
  },
}));

export interface CardProps extends Omit<MuiCardProps, 'elevation'> {
  /**
   * Shadow elevation level (Material-UI elevation)
   * @default 1
   */
  elevation?: number;
  /**
   * Padding inside the card
   * @default theme.spacing(2)
   */
  padding?: number | string;
  /**
   * Add hover effects (shadow transition and translateY)
   * @default false
   */
  interactive?: boolean;
  /**
   * Add border with theme divider color
   * @default false
   */
  border?: boolean;
  /**
   * Click handler (sets cursor to pointer when interactive is true)
   */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

/**
 * Base Card component matching Backstage's default styling
 *
 * Default styling:
 * - Elevation: 1 (matching Backstage InfoCard)
 * - Border-radius: 4px (Material-UI default)
 * - No border (unless border prop is true)
 *
 * Props:
 * - interactive: Adds hover effects (shadow elevation 1→3, translateY(-2px))
 * - border: Adds 1px border with theme divider color
 * - padding: Custom padding value
 * - elevation: Custom shadow elevation (default: 1)
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      elevation = 1,
      padding,
      interactive = false,
      border = false,
      children,
      className,
      style,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const classes = useStyles();

    const cardStyle = {
      ...style,
      ...(padding !== undefined && { padding }),
    };

    const cardClassName = [
      classes.card,
      interactive && classes.interactive,
      border && classes.bordered,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <MuiCard
        ref={ref}
        elevation={elevation}
        className={cardClassName}
        style={cardStyle}
        onClick={onClick}
        {...rest}
      >
        {children}
      </MuiCard>
    );
  },
);

Card.displayName = 'Card';
