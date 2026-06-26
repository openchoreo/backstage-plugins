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
import { Observations } from "../../types";
import { useDiagramContext } from "../DiagramContext/DiagramContext";

const Table = styled.table`
    width: 100%;
`;

const TableRow = styled.tr``;

const TableHeader = styled.td`
    padding: 2px 2px;
    text-align: left;
    font-family: "GilmerMedium";
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
`;

const TopTableHeader = styled(TableHeader)`
    text-align: right;
    max-width: 120px;
`;

const TableData = styled.td`
    padding: 2px 2px 2px 8px;
    color: ${({ theme }) => theme.colors.PRIMARY};
    text-align: right;
    font-family: "GilmerRegular";
`;

const convertToMs = (value: number) => (value / 1000 / 1000).toFixed(value / 1000 / 1000 > 100 ? 1 : 2);

interface ObservationLabelProps {
    observations: Observations[];
}

function formatLatency(value: number): string {
    return value < 1 ? `${(value * 1000).toFixed(2)} ms` : `${value.toFixed(2)} s`;
}

export function ObservationLabel({ observations }: ObservationLabelProps) {
    const { modelVersion } = useDiagramContext();

    // Slice the observations array to include only up to the first 5 elements
    // TODO: Add a "View All" button to view all observations
    const displayedObservations = observations.slice(0, 5);

    let metrics = [
        { name: "Request Count", valueFn: (obs: Observations) => obs.requestCount },
        {
            name: "Error Percentage",
            valueFn: (obs: Observations) => `${((obs.errorCount * 100) / obs.requestCount).toFixed(2)  }%`,
        },
        { name: "Average Latency", valueFn: (obs: Observations) => `${convertToMs(obs.avgLatency)  } ms` },
        { name: "99% Latency", valueFn: (obs: Observations) => `${convertToMs(obs.p99Latency)  } ms` },
        { name: "90% Latency", valueFn: (obs: Observations) => `${convertToMs(obs.p90Latency)  } ms` },
        { name: "50% Latency", valueFn: (obs: Observations) => `${convertToMs(obs.p50Latency)  } ms` },
    ];

    if (modelVersion === "v2") {
        metrics = [
            { name: "Request Count", valueFn: (obs: Observations) => obs.requestCount.toFixed(0) },
            {
                name: "Error Percentage",
                valueFn: (obs: Observations) => `${((obs.errorCount * 100) / obs.requestCount).toFixed(2)  }%`,
            },
            { name: "Average Latency", valueFn: (obs: Observations) => formatLatency(obs.avgLatency) },
            { name: "99% Latency", valueFn: (obs: Observations) => formatLatency(obs.p99Latency) },
            { name: "90% Latency", valueFn: (obs: Observations) => formatLatency(obs.p90Latency) },
            { name: "50% Latency", valueFn: (obs: Observations) => formatLatency(obs.p50Latency) },
        ];
    }

    function formatNumberWithCommas(x: string): string {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    return (
        <Table>
            <thead>
                <TableRow>
                    <TableHeader />
                    {displayedObservations.map((obs, index) => (
                        <TopTableHeader key={index}>{obs.label || obs.componentVersion || ""}</TopTableHeader>
                    ))}
                </TableRow>
            </thead>
            <tbody>
                {metrics.map((metric) => (
                    <TableRow key={metric.name}>
                        <TableHeader>{metric.name}</TableHeader>
                        {displayedObservations.map((obs, index) => (
                            <TableData key={index}>{formatNumberWithCommas(metric.valueFn(obs).toString())}</TableData>
                        ))}
                    </TableRow>
                ))}
            </tbody>
        </Table>
    );
}
