/** @odoo-module **/

import { GraphRenderer } from "@web/views/graph/graph_renderer";
import { groupBy } from "@web/core/utils/arrays";


export class HrHolidaysGraphRenderer extends GraphRenderer {
    delimiter = ' / ';

    getBarChartData() {
        let data = super.getBarChartData();
        for (let index = 0; index < data.datasets.length; ++index) {
            const dataset = data.datasets[index];
            // dataset.label takes the form 'Mitchell Admin / Paid Time Off / Allocation'.
            if (dataset.label.split(this.delimiter).includes('Allocation')){
                dataset.stack = "Allocation";
            }
            else if (dataset.label.split(this.delimiter).includes('Time Off')){
                dataset.stack = "Time Off";
            }
        }

        if (!(data.datasets.every(dataset => dataset.stack === 'Allocation')
            || data.datasets.every(dataset => dataset.stack === 'Time Off'))){
            let balanceDatasets = this._computeBalanceDatasets(data);
            data.datasets.push(...balanceDatasets);
        }

        // Change time off data to +ve values to be better visualized in the graph view.
        for (let dataset of data.datasets.filter(dataset => dataset.stack === 'Time Off')){
            dataset.data = dataset.data.map(datapoint => -datapoint);
        }
        return data;
    }

    _computeBalanceDatasets(data) {
        const datasetsByLabel = groupBy(data.datasets, 
            (dataset) => dataset.label.split(this.delimiter)
            .map(group => group === 'Allocation' || group === 'Time Off' ? 'Balance' : group)
            .join(this.delimiter)
        );
        const balanceDatasets = Object.entries(datasetsByLabel).map(([label, datasets]) =>
            this._initializeBalanceDatasetFrom(datasets, label)
        );
        return balanceDatasets;
    }

    _initializeBalanceDatasetFrom(datasets, label){
        let dataset = datasets[0];
        let backgroundColor = datasets.filter(dataset => dataset.stack === 'Allocation')[0]?.backgroundColor;
        if (!backgroundColor){
            backgroundColor = dataset.backgroundColor;
        }

        let balanceDataset = {
            'trueLabels': dataset.trueLabels,
            'stack': "Balance",
            'originIndex': dataset.originIndex,
            'label': label,
            'backgroundColor': backgroundColor,
            'borderRadius': dataset.borderRadius,
            'cumulatedStart': dataset.cumulatedStart,
        };
 
        balanceDataset.domains = dataset.domains.map(domain => 
            domain.map(condition => 
                condition.includes('leave_type')
                ? ['leave_type', 'in', ['allocation', 'request']]
                : condition
            )
        ); 

        /* Because the balanceDataset includes both `Allocation` and `Time Off` records: {"leave_type":"allocation"} and {"leave_type":"request"} are removed from identifiers.
        For example: the identifier "[{"employee_id":[1,"Mitchell Admin"]},{"leave_type":"allocation"}]" becomes "[{"employee_id":[1,"Mitchell Admin"]}]" */
        balanceDataset.identifiers = new Set([...dataset.identifiers].map(identifier => 
                JSON.stringify( 
                    JSON.parse(identifier) // The output is an array of objects.
                    .filter(identifierObject => !identifierObject.hasOwnProperty('leave_type'))
                )
            )
        );

        balanceDataset.data = new Array(balanceDataset.trueLabels.length).fill(0);
        for (const dataset of datasets){
            for (let i = 0; i < dataset.data.length; i++){
                balanceDataset.data[i] += dataset.data[i];
            }
        }
        return balanceDataset;
    }
}
