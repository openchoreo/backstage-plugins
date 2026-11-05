import { InputError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import {
  OpenChoreoTokenService,
  createUserTokenMiddleware,
  getUserTokenFromRequest,
} from '@openchoreo/openchoreo-auth';
import { ImageSecurityService } from './services/ImageSecurityService';

export async function createRouter({
  imageSecurityService,
  tokenService,
}: {
  imageSecurityService: ImageSecurityService;
  tokenService: OpenChoreoTokenService;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());
  router.use(createUserTokenMiddleware(tokenService));

  // Read-only. The OpenChoreo API calls run with the user's token, so a user
  // only sees components they may view.
  router.get('/vulnerabilities', async (req, res) => {
    const { namespaceName, componentName } = req.query;
    // Repeated parameters (`?a=1&a=2`) arrive as arrays; reject them instead of
    // passing them on into the API path.
    if (
      typeof namespaceName !== 'string' ||
      typeof componentName !== 'string' ||
      !namespaceName ||
      !componentName
    ) {
      throw new InputError(
        'namespaceName and componentName are required single-valued query parameters',
      );
    }
    res.json(
      await imageSecurityService.getComponentImageSecurity(
        namespaceName,
        componentName,
        getUserTokenFromRequest(req),
      ),
    );
  });

  return router;
}
