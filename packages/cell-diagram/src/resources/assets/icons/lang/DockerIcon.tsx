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

import { CSSProperties } from "react";

export function DockerIcon(props: { styles?: CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 185" style={{ ...props.styles }}>
            <path
                fill="#2396ED"
                d="M250.716 70.497c-5.765-4-18.976-5.5-29.304-3.5c-1.2-10-6.725-18.749-16.333-26.499l-5.524-4l-3.844 5.75c-4.803 7.5-7.205 18-6.485 28c.24 3.499 1.441 9.749 5.044 15.249c-3.362 2-10.328 4.5-19.455 4.5H1.155l-.48 2c-1.682 9.999-1.682 41.248 18.014 65.247c14.892 18.249 36.99 27.499 66.053 27.499c62.93 0 109.528-30.25 131.386-84.997c8.647.25 27.142 0 36.51-18.75c.24-.5.72-1.5 2.401-5.249l.961-2l-5.284-3.25ZM139.986 0h-26.42v24.999h26.42V0Zm0 29.999h-26.42v24.999h26.42v-25Zm-31.225 0h-26.42v24.999h26.42v-25Zm-31.225 0H51.115v24.999h26.421v-25ZM46.311 59.998H19.89v24.999h26.42v-25Zm31.225 0H51.115v24.999h26.421v-25Zm31.225 0h-26.42v24.999h26.42v-25Zm31.226 0h-26.422v24.999h26.422v-25Zm31.225 0H144.79v24.999h26.422v-25Z"
            />
        </svg>
    );
}
