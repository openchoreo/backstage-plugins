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
import { ProjectModel } from './ProjectModel';
import { ProjectWidget } from './ProjectWidget';
import { PROJECT_NODE } from '../../../resources';

export class ProjectFactory extends AbstractReactFactory<ProjectModel, DiagramEngine> {
    constructor() {
        super(PROJECT_NODE);
    }

    generateReactWidget(event: { model: ProjectModel }): JSX.Element {
        return <ProjectWidget engine={this.engine} node={event.model} />;
    }

    generateModel(event: { initialConfig: any }) {
        return new ProjectModel(event.initialConfig.component);
    }
}
