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

export function PythonIcon(props: { styles?: CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32" style={{ ...props.styles }}>
            <defs>
                <linearGradient
                    id="vscodeIconsFileTypePython0"
                    x1="-133.268"
                    x2="-133.198"
                    y1="-202.91"
                    y2="-202.84"
                    gradientTransform="matrix(189.38 0 0 189.81 25243.061 38519.17)"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0" stopColor="#387eb8" />
                    <stop offset="1" stopColor="#366994" />
                </linearGradient>
                <linearGradient
                    id="vscodeIconsFileTypePython1"
                    x1="-133.575"
                    x2="-133.495"
                    y1="-203.203"
                    y2="-203.133"
                    gradientTransform="matrix(189.38 0 0 189.81 25309.061 38583.42)"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0" stopColor="#ffe052" />
                    <stop offset="1" stopColor="#ffc331" />
                </linearGradient>
            </defs>
            <path
                fill="url(#vscodeIconsFileTypePython0)"
                d="M15.885 2.1c-7.1 0-6.651 3.07-6.651 3.07v3.19h6.752v1H6.545S2 8.8 2 16.005s4.013 6.912 4.013 6.912H8.33v-3.361s-.13-4.013 3.9-4.013h6.762s3.772.06 3.772-3.652V5.8s.572-3.712-6.842-3.712Zm-3.732 2.137a1.214 1.214 0 1 1-1.183 1.244v-.02a1.214 1.214 0 0 1 1.214-1.214Z"
            />
            <path
                fill="url(#vscodeIconsFileTypePython1)"
                d="M16.085 29.91c7.1 0 6.651-3.08 6.651-3.08v-3.18h-6.751v-1h9.47S30 23.158 30 15.995s-4.013-6.912-4.013-6.912H23.64V12.4s.13 4.013-3.9 4.013h-6.765S9.2 16.356 9.2 20.068V26.2s-.572 3.712 6.842 3.712h.04Zm3.732-2.147A1.214 1.214 0 1 1 21 26.519v.03a1.214 1.214 0 0 1-1.214 1.214h.03Z"
            />
        </svg>
    );
}
