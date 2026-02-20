import React from 'react';
import ReactApexChart from 'react-apexcharts';
import { colorToRgbaString, readBrandingColor } from '../../../lib/brandingColors';

const ReturningCustomerChart = () => {
    const primaryColor = readBrandingColor('--bs-primary', '#0d6efd');
    const secondaryColor = colorToRgbaString(primaryColor, 0.55, '#0d6efd');

    var options = {
        stroke: {
            lineCap: 'round'
        },
        chart: {
            height: 235,
            type: 'radialBar',
        },
        plotOptions: {
            radialBar: {
                hollow: {
                    margin: 0,
                    size: "55%",
                },
                dataLabels: {
                    showOn: "always",
                    name: {
                        show: false,
                    },
                    value: {
                        fontSize: "1.75rem",
                        show: true,
                        fontWeight: '500'
                    },
                    total: {
                        show: true,
                        formatter: function () {
                            return [('$2249')];
                        }
                    }
                }
            }
        },
        colors: [primaryColor, secondaryColor],
        labels: ['Subscriptions', 'Food'],
    };

    const series = [80, 75];

    return <ReactApexChart options={options} series={series} type="radialBar" height={235} />
}

export default ReturningCustomerChart
