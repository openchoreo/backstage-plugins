/*
 * Copyright (c) 2025, WSO2 LLC. (http://www.wso2.com) All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { ExternalModel } from './ExternalModel';
import { ExternalWidget } from './ExternalWidget';
import { EXTERNAL_NODE } from '../../../resources';

export class ExternalFactory extends AbstractReactFactory<ExternalModel, DiagramEngine> {
    constructor() {
        super(EXTERNAL_NODE);
    }

    generateReactWidget(event: { model: ExternalModel }): JSX.Element {
        return <ExternalWidget engine={this.engine} node={event.model} />;
    }

    generateModel(event: { initialConfig: any }) {
        return new ExternalModel(event.initialConfig.key);
    }
}
