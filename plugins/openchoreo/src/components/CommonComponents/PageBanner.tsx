import { Box, Typography } from '@material-ui/core'
import ErrorIcon from '@material-ui/icons/Error'

export interface PageBannerProps {
    title: string
    description: string
    icon?: React.ReactNode
    transparent?: boolean
}
const PageBanner = ({ title, description, icon, transparent }: PageBannerProps) => {
    return (
        <Box width="100%" height="100%" display="flex" py={2} flexDirection="column" alignItems="center" justifyContent="center" sx={{ bgcolor: transparent ? 'transparent' : 'inherit' }}>
            {icon || <ErrorIcon fontSize='large' />}
            <Typography variant="overline">
                {title}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
                {description}
            </Typography>
        </Box>
    )
}

export default PageBanner
