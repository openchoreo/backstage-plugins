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

import styled from "@emotion/styled";

const Container = styled.div`
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    height: 100%;
    width: 100%;
    background-image: radial-gradient(${({ theme }) => theme.colors.SURFACE_CONTAINER} 10%, transparent 0px);
    background-size: 16px 16px;
    background-color: ${({ theme }) => theme.colors.SURFACE_BRIGHT};
`;

const MassageBox = styled.h3`
    color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
    font-family: GilmerRegular;
    font-size: 16px;
    padding: 10px;
`;

export interface PromptScreenProps {
    userMessage: string;
}

export function PromptScreen(props: PromptScreenProps) {
    const { userMessage } = props;

    return (
        <Container>
            <MassageBox>{userMessage}</MassageBox>
        </Container>
    );
}
