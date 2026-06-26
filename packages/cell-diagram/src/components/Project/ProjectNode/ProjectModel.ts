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

import { PortModelAlignment } from "@projectstorm/react-diagrams";
import { SharedNodeModel } from "../../SharedNode/SharedNode";
import { ProjectPortModel } from "../ProjectPort/ProjectPortModel";
import { Project } from "../../../types";
import { PROJECT_NODE } from "../../../resources";
import { getProjectNameById } from "../../../utils";

export class ProjectModel extends SharedNodeModel {
    readonly project: Project;

    constructor(project: Project) {
        const name = getProjectNameById(project.id);
        super(PROJECT_NODE, name);
        this.project = project;
        // this.setLocked(true);

        this.addPort(new ProjectPortModel(name, PortModelAlignment.LEFT));
        this.addPort(new ProjectPortModel(name, PortModelAlignment.RIGHT));

        this.addPort(new ProjectPortModel(name, PortModelAlignment.TOP));
        this.addPort(new ProjectPortModel(name, PortModelAlignment.BOTTOM));
    }

    getPort(name: string): ProjectPortModel {
        return this.getPorts()[name] as ProjectPortModel;
    }
}
