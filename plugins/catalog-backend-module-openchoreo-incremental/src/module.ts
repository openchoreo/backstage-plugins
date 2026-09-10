/*
 * Copyright 2022 The Backstage Authors
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

/**
 * Module definition for OpenChoreo incremental ingestion.
 * Exports the main catalog module for incremental entity processing.
 */

import { createBackendFeatureLoader } from '@backstage/backend-plugin-api';
import catalogModuleOpenchoreoIncrementalEntityProvider, {
  catalogModuleOpenchoreoIncrementalProvider,
} from './module/index';

/**
 * The full incremental ingestion composition, installed with a single
 * `backend.add(import(...))`.
 *
 * Yields the wrapper module (extension point + admin router + provider
 * wrapping) first — it registers the `openchoreoIncrementalProvidersExtensionPoint`
 * the provider module consumes — then the OpenChoreo provider module that
 * registers `OpenChoreoIncrementalEntityProvider` through it. Both are inert
 * unless `openchoreo.features.incrementalIngestion.enabled` is true.
 */
export const catalogModuleOpenchoreoIncremental = createBackendFeatureLoader({
  *loader() {
    yield catalogModuleOpenchoreoIncrementalEntityProvider;
    yield catalogModuleOpenchoreoIncrementalProvider;
  },
});
