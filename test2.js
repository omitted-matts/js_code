workbenchApp.controller('dashboardCtrl', function($scope, DeviceDownloadService, OrderLogService,
        TimeZonesService, FailedOrderService, $location) {
    var ddSummaryObj = {};
    var deviceDownloads = undefined;
    var CSVContent = 'Date,OS,Downloads\n';

    $scope.totalDownloads = undefined;
    $scope.ddSummary = [];
    $scope.orders = null;
    $scope.dailyTotals = null;
    $scope.monthlyTotals = null;
    $scope.isSaving = true;
    $scope.numDays = 30;
    $scope.recordFilter = '';
    $scope.totalsToDate = null;
    $scope.currencySymbol = null;
    $scope.checkoutLiveDate = null;
    $scope.orderLabels = null;
    $scope.orderSeries = null;
    $scope.orderData = null;
    $scope.dailyLabels = null;
    $scope.dailySeries = null;
    $scope.dailyData = null;
    $scope.years = [];
    $scope.duration = 'MONTH';
    $scope.year = moment().year();
    $scope.month = parseInt(moment().format('M'));
    $scope.frequency = 'DAILY';
    $scope.dateRangeStart = moment().subtract(30, 'days').format('MMM DD,YYYY');
    $scope.dateRangeEnd = moment().format('MMM DD, YYYY');
    $scope.timeZones = null;
    $scope.timeZone = 'UTC';
    $scope.currentPath = '/';
    $scope.colors = ['#45b7cd', '#ff6384', '#ff8e72'];
    $scope.labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Options and graph configurations
    $scope.options = {
        tooltips: {
            enabled: true,
            mode: 'nearest',
            callbacks: {
                label: function(tooltipItem, data) {
                    let datasetLabel = data.datasets[tooltipItem.datasetIndex]
                            .data[tooltipItem.index];
                    return ' ' + format(datasetLabel);
                },
            },
        },
        scales: {
            yAxes: [{
                ticks: {
                    min: 0,
                },
            }],
        },
        responsive: true,
        maintainAspectRatio: false,
    };
    $scope.notificationOrderOptions = {
        scales: {
            yAxes: [{
                ticks: {
                    min: 0,
                },
            }],
        },
        responsive: true,
        maintainAspectRatio: false,
    };
    $scope.comparisonGraphOptions = {
        legend: {
            display: true,
            position: 'bottom',
        },
        responsive: true,
        maintainAspectRatio: false,
    };

    $scope.datasetOverride = [
        {
            label: 'Bar chart',
            borderWidth: 1,
            type: 'bar',
        },
        {
            label: 'Line chart',
            borderWidth: 3,
            hoverBackgroundColor: 'rgba(255,99,132,0.4)',
            hoverBorderColor: 'rgba(255,99,132,1)',
            type: 'bubble',
        },
    ];

    /**
     * Calls everything which needs to be called
     * @constructor
     */
    let init = function() {
        getTimeZonesAndUpdateOrders();
        constructYears();
        generateGraphForTotalDeviceDownloads();
        generateFailedOrdersCard();
    };

    /**
     * Transforms the order object
     * @param {Object} param
     */
    $scope.updateOrdersByParam = function(param) {
        $scope.isSaving = true;
        let JSONObj = {
            'timeZone': param.timeZone ? param.timeZone : $scope.timeZone,
            'range': {
                'type': param.duration ? param.duration : $scope.duration,
                'frequency': param.frequency ? param.frequency : $scope.frequency,
                'month': param.month ? param.month : $scope.month,
                'year': param.year ? param.year : $scope.year,
                'startDay': param.dateRangeStartDay ? param.dateRangeStartDay:
                        parseInt(moment($scope.dateRangeStart).format('DD')),
                'startMonth': param.dateRangeStartMonth ? param.dateRangeStartMonth:
                        parseInt(moment($scope.dateRangeStart).format('MM')),
                'startYear': param.dateRangeStartYear ? param.dateRangeStartYear:
                        parseInt(moment($scope.dateRangeStart).format('YYYY')),
                'endDay': param.dateRangeEndDay ? param.dateRangeEndDay:
                        parseInt(moment($scope.dateRangeEnd).format('DD')),
                'endMonth': param.dateRangeEndMonth ? param.dateRangeEndMonth:
                        parseInt(moment($scope.dateRangeEnd).format('MM')),
                'endYear': param.dateRangeEndYear ? param.dateRangeEndYear:
                        parseInt(moment($scope.dateRangeEnd).format('YYYY')),
            },
            'orders': {
                'include': true,
                'numDays': param.numDays ? param.numDays : $scope.numDays,
            },
        };
        // @Refactor: This needs to be simplified or have the logic extracted to helper methods.
        OrderLogService.save(JSONObj).$promise.then(function(data) {
            if (data.summary) {
                $scope.checkoutLiveDate = data.checkoutLiveDate;
                $scope.orders = data.orders;
                $scope.currencySymbol = angular.copy(data.currencySymbol);
                $scope.totalsToDate = angular.copy(data.summary.totals);
                // Create chart for daily totals
                if (data.summary.frequency && data.summary.frequency === 'DAILY' &&
                        param.duration==='CUSTOM') {
                    $scope.dailyTotals = data.summary.totals;
                    $scope.dailyLabels = [];
                    $scope.dailySeries = [('DAILY_TOTAL_REVENUE'.replace(/_/g, ' '))];
                    let dailyData = [];
                    let dailyDataArr = [];
                    let date = '';
                    for (let i = $scope.dailyTotals.length - 1; i >= 0; i--) {
                        date = $scope.dailyTotals[i].date;
                        $scope.dailyLabels.push(moment(date).format('MMM, D'));
                        dailyDataArr.push(fixedNumber($scope.dailyTotals[i].orderTotal));
                        $scope.dailyTotals[i].formattedDate = date.toString();
                        $scope.dailyTotals[i].orderTotal = format($scope.dailyTotals[i].orderTotal);
                    }
                    dailyData.push(dailyDataArr);
                    $scope.dailyData = dailyData;
                } else if (data.summary.frequency && data.summary.frequency === 'MONTHLY') {
                    // Create chart for monthly totals
                    $scope.monthlyTotals = angular.copy(data.summary.totals);
                    $scope.monthlyLabels = [];
                    $scope.monthlySeries = ['MONTHLY_TOTAL_REVENUE'.replace(/_/g, ' ')];
                    $scope.monthlyData = [];
                    let monthlyDataArr = [];
                    for (let i = $scope.monthlyTotals.length - 1; i >= 0; i--) {
                        let str = '' + $scope.monthlyTotals[i].year.toString() + '-' +
                                $scope.monthlyTotals[i].month.toString() + '-15';
                        let date = moment(str).format('MMM, YYYY');
                        $scope.monthlyTotals[i].formattedDate = date;
                        $scope.monthlyLabels.push(date);
                        monthlyDataArr.push(fixedNumber($scope.monthlyTotals[i].orderTotal));
                        $scope.monthlyTotals[i].orderTotal =
                                format($scope.monthlyTotals[i].orderTotal);
                    }
                    $scope.monthlyData.push(monthlyDataArr);
                } else if (data.summary.frequency && data.summary.frequency === 'YEARLY') {
                    // Create chart for yearly totals
                    $scope.yearlyTotals = angular.copy(data.summary.totals);
                    $scope.yearlyLabels = [];
                    $scope.yearlySeries = ['YEARLY_TOTAL_REVENUE'.replace(/_/g, ' ')];
                    $scope.yearlyData = [];
                    let yearlyDataArr = [];
                    for (let i = $scope.yearlyTotals.length - 1; i >= 0; i--) {
                        let label = $scope.yearlyTotals[i].year;
                        $scope.yearlyTotals[i].formattedDate = label;
                        $scope.yearlyLabels.push(label);
                        yearlyDataArr.push(fixedNumber($scope.yearlyTotals[i].orderTotal));
                        $scope.yearlyTotals[i].orderTotal =
                                format($scope.yearlyTotals[i].orderTotal);
                    }
                    $scope.yearlyData.push(yearlyDataArr);
                } else if (data.summary.frequency && data.summary.frequency === 'QUARTERLY') {
                    // Create chart for quarterly totals
                    $scope.quarterlyTotals = angular.copy(data.summary.totals);
                    $scope.quarterlyLabels = [];
                    $scope.quarterlySeries = ['QUARTERLY_TOTAL_REVENUE'.replace(/_/g, ' ')];
                    $scope.quarterlyData = [];
                    let quarterlyDataArr = [];
                    for (let i = $scope.quarterlyTotals.length - 1; i >= 0; i--) {
                        let label = $scope.quarterlyTotals[i].year + ', ' +
                                $scope.quarterlyTotals[i].quarter;
                        $scope.quarterlyTotals[i].formattedDate = label;
                        $scope.quarterlyLabels.push(label);
                        quarterlyDataArr.push(fixedNumber($scope.quarterlyTotals[i].orderTotal));
                        $scope.quarterlyTotals[i].orderTotal =
                                format($scope.quarterlyTotals[i].orderTotal);
                    }
                    $scope.quarterlyData.push(quarterlyDataArr);
                } else if (data.summary.frequency && data.summary.frequency === 'TOTAL') {
                    $scope.totalsToDate[0].orderTotal = format($scope.totalsToDate[0].orderTotal);
                }
                // Create chart for Orders
                if (param.numDays) {
                    $scope.orderLabels = [];
                    $scope.orderSeries = ['CREDIT CARD', 'ANDROID PAY', 'APPLE PAY'];
                    $scope.yesterdayOrderData = [];
                    $scope.orderData = [];
                    let credit = [];
                    let apple = [];
                    let android = [];
                    let creditObj = {};
                    let appleObj = {};
                    let androidObj = {};
                    for (let i = $scope.orders.length - 1; i >= 0; i--) {
                        let orderDate = moment($scope.orders[i].orderDate).format('MMM DD,YYYY');
                        let amount = angular.copy($scope.orders[i].amount);
                        amount = fixedNumber(amount);
                        $scope.orders[i].amount = format($scope.orders[i].amount);
                        if (creditObj[orderDate] === undefined) {
                            creditObj[orderDate] = 0;
                        }
                        if (appleObj[orderDate] === undefined) {
                            appleObj[orderDate] = 0;
                        }
                        if (androidObj[orderDate] === undefined) {
                            androidObj[orderDate] = 0;
                        }
                        if ($scope.orders[i].paymentSource === 'CreditCard') {
                            creditObj[orderDate] += fixedNumber(amount);
                        } else if ($scope.orders[i].paymentSource === 'ApplePay') {
                            appleObj[orderDate] += fixedNumber(amount);
                        } else {
                            androidObj[orderDate] += fixedNumber(amount);
                        }
                    }
                    for (let key in creditObj) {
                        if (!creditObj.hasOwnProperty(key)) continue;
                        credit.push(fixedNumber(creditObj[key]));
                        apple.push(fixedNumber(appleObj[key]));
                        android.push(fixedNumber(androidObj[key]));
                        $scope.orderLabels.push(moment(key).format('MMM, D'));
                    }

                    $scope.orderData.push(credit);
                    $scope.orderData.push(android);
                    $scope.orderData.push(apple);
                    $scope.yesterdayOrderData.push(credit.length > 0 ?
                            credit[credit.length - 1] : 0);
                    $scope.yesterdayOrderData.push(android.length > 0 ?
                            android[android.length - 1] : 0);
                    $scope.yesterdayOrderData.push(apple.length > 0 ?
                            apple[apple.length - 1] : 0);
                    $scope.yesterdayTotalOrderData = credit[0] + android[0] + apple[0];
                    $scope.strokeColors = ['#dce775', '#a5d6a7', '#8eacbb'];
                }
            }
            $scope.currentPath = $location.path();
            if (!$scope.totalsToDate && $location.path() === '/') {
                $location.url('/mobileConfigs/edit');
            }
            $scope.isSaving = false;
        }, function(e) {
            alert('Sorry! error occurred while getting the data!');
            $scope.isSaving = false;
        });
    };

    $scope.downloadCSV = function() {
        window.open('data:text/csv;charset=utf-8,' + encodeURI(CSVContent));
    };

    /**
     * Date changed event handler
     * @param {Date} newDate
     * @param {String} key
     * @param {Object} format
     */
    $scope.dateChanged = function(newDate, key, format) {
        $scope[key] = moment(newDate).format(format);
    };

    /**
     * called prior to rendering the start date
     * @param {Object} $view
     * @param {Object} $dates
     * @param {Object} $leftDate
     * @param {Object} $upDate
     * @param {Object} $rightDate
     * @param {Object} dateRangeEnd
     */
    $scope.beforeRenderStartDate = function($view, $dates, $leftDate, $upDate, $rightDate,
            dateRangeEnd) {
        if ($scope.dateRangeEnd) {
            let activeDate = moment($scope.dateRangeEnd);
            for (let i = 0; i < $dates.length; i++) {
                if ($dates[i].localDateValue() >= activeDate.valueOf()) {
                    $dates[i].selectable = false;
                }
            }
        }
    };

    /**
     * called prior to rendering the end date
     * @param {Object} $view
     * @param {Object} $dates
     * @param {Object} $leftDate
     * @param {Object} $upDate
     * @param {Object} $rightDate
     */
    $scope.beforeRenderEndDate = function($view, $dates, $leftDate, $upDate, $rightDate) {
        if ($scope.dateRangeStart) {
            let activeDate = moment($scope.dateRangeStart).subtract(1, $view).add(1, 'minute');
            for (let i = 0; i < $dates.length; i++) {
                if ($dates[i].localDateValue() <= activeDate.valueOf()) {
                    $dates[i].selectable = false;
                }
            }
        }
    };

    /**
     * template helper for formating a String
     * @param {String} val
     * @return {String}
     */
    $scope.formatSource = function(val) {
        return val.replace(/_/g, ' ');
    };

    /**
     * template helper for formating an order date
     * @param {Date} order
     * @return {Date}
     */
    $scope.uniqueFilter = function(order) {
        return moment(order).format('MMM DD,YYYY - hh:mm');
    };

    /**
     * @param {Object} row
     */
    $scope.selectedRowCallback = function(row) {
        let data = failedOrdersMap[row[0][0].value];
        let output = 'Order details: \n\n';
        for (let i in data.itemList) {
            let row = data.itemList[i];
            output += 'product id: ' + row.productId +
                ', quantity: ' + row.quantity +
                ', price: ' +row.price + '\n\n';
        }
        alert(output);
    };

    // helpers
    let getTimeZonesAndUpdateOrders = function() {
        TimeZonesService.get().$promise.then(function(data) {
            $scope.timeZones = data.timeZones;
            $scope.timeZone = data.merchantTimeZone ? data.merchantTimeZone : 'UTC';
            $scope.updateOrdersByParam({'numDays': 30});
            $scope.updateOrdersByParam({
                'duration': 'CUSTOM',
                'frequency': 'DAILY',
                'month': parseInt(moment().format('M')),
                'year': moment().year(),
                'dateRangeStartDay': parseInt(moment().subtract(1, 'months').format('DD')),
                'dateRangeStartMonth': parseInt(moment().subtract(1, 'months').format('MM')),
                'dateRangeStartYear': parseInt(moment().subtract(1, 'months').format('YYYY')),
                'dateRangeEndDay': parseInt(moment().format('DD')),
                'dateRangeEndMonth': parseInt(moment().format('MM')),
                'dateRangeEndYear': parseInt(moment().format('YYYY'))
            });
            $scope.updateOrdersByParam({
                'duration': 'CUSTOM',
                'frequency': 'MONTHLY',
                'month': parseInt(moment().format('M')),
                'year': moment().year(),
                'dateRangeStartDay': 1,
                'dateRangeStartMonth': parseInt(moment().add(1, 'months').format('MM')),
                'dateRangeStartYear': parseInt(moment().subtract(1, 'years').format('YYYY')),
                'dateRangeEndDay': parseInt(moment().format('DD')),
                'dateRangeEndMonth': parseInt(moment().format('MM')),
                'dateRangeEndYear': parseInt(moment().format('YYYY')),
            });
            $scope.updateOrdersByParam({
                'duration': 'LIFETIME',
                'frequency': 'QUARTERLY',
            });
            $scope.updateOrdersByParam({
                'duration': 'LIFETIME',
                'frequency': 'YEARLY',
            });
        }, function(e) {
            alert('Sorry! error occurred while getting the data!');
        });
    };

    /**
     * Makes an api call which grabs the failed orders and displays a card at the top of dashboard
     */
    let generateFailedOrdersCard = function() {
        FailedOrderService.upload({'status': 'FAILED', 'days': 60, 'method': 'POST'}).$promise
                .then(function(data) {
            $scope.failedOrders = data.orderDetail;
            console.log(data.orderDetail);
            // Note: MDTable requires a callback, but I was not able to pass the scope.
            window.failedOrdersMap = [];
            for (let i in data.orderDetail) {
                window.failedOrdersMap[data.orderDetail[i].orderNo] = data.orderDetail[i];
            }
        }, function(e) {
            console.error(e);
        });
    };

    /**
     * Generates Total device downloads graph
     */
    let generateGraphForTotalDeviceDownloads = function() {
        DeviceDownloadService.get().$promise.then(function(data) {
            deviceDownloads = data.dateWiseCount;
            $scope.totalDownloads = data['totalCount'];
            $scope.downloadsData = [];
            $scope.cumulativeDownloadsData = [];
            $scope.downloadsSeries = [];
            $scope.downloadsLabels = [];
            let tempQuarterlyDownloads = {
                TOTAL: {},
            };
            let tempQuarterlyYear = '';
            for (let i = 0; i < deviceDownloads.length; i++) {
                CSVContent += '\'' + deviceDownloads[i].date + '\',';
                CSVContent += deviceDownloads[i].os + ',';
                CSVContent += deviceDownloads[i].count + '\r\n';
                if (!ddSummaryObj[deviceDownloads[i].os]) {
                    ddSummaryObj[deviceDownloads[i].os] = deviceDownloads[i].count;
                } else {
                    ddSummaryObj[deviceDownloads[i].os] += deviceDownloads[i].count;
                }
                tempQuarterlyYear = moment(deviceDownloads[i].date).format('YYYY') + '_Q' +
                        moment(deviceDownloads[i].date).quarter();
                if (!tempQuarterlyDownloads[deviceDownloads[i].os]) {
                    tempQuarterlyDownloads[deviceDownloads[i].os] = {};
                }
                if (!tempQuarterlyDownloads[deviceDownloads[i].os][tempQuarterlyYear]) {
                    tempQuarterlyDownloads[deviceDownloads[i].os][tempQuarterlyYear] = 0;
                }
                tempQuarterlyDownloads[deviceDownloads[i].os][tempQuarterlyYear] +=
                        deviceDownloads[i].count;
                if (!tempQuarterlyDownloads.TOTAL[tempQuarterlyYear]) {
                    tempQuarterlyDownloads.TOTAL[tempQuarterlyYear] = 0;
                }
                tempQuarterlyDownloads.TOTAL[tempQuarterlyYear] += deviceDownloads[i].count;
            }
            angular.forEach(tempQuarterlyDownloads.TOTAL, function(val, key) {
                $scope.downloadsLabels.push(key);
            });
            angular.forEach(tempQuarterlyDownloads, function(val, key) {
                $scope.downloadsSeries.push(key);
                $scope.downloadsData.push([]);
                $scope.cumulativeDownloadsData.push([]);
                let downloadsDataCurrentIndex = $scope.downloadsData.length - 1;
                angular.forEach(tempQuarterlyDownloads.TOTAL, function(val1, key1) {
                    if (!tempQuarterlyDownloads[key][key1]) {
                        tempQuarterlyDownloads[key][key1] = 0;
                    }
                    $scope.downloadsData[downloadsDataCurrentIndex]
                            .push(tempQuarterlyDownloads[key][key1]);
                });
                $scope.downloadsData[downloadsDataCurrentIndex].reverse();
                for (let i = 0; i < $scope.downloadsData[downloadsDataCurrentIndex].length; i++) {
                    if (i === 0) {
                        $scope.cumulativeDownloadsData[downloadsDataCurrentIndex][i] =
                            $scope.downloadsData[downloadsDataCurrentIndex][i];
                    } else {
                        $scope.cumulativeDownloadsData[downloadsDataCurrentIndex][i] =
                            $scope.cumulativeDownloadsData[downloadsDataCurrentIndex][i - 1] +
                            $scope.downloadsData[downloadsDataCurrentIndex][i];
                    }
                }
            });
            for (let i = 0; i < $scope.downloadsLabels.length; i++) {
                $scope.downloadsLabels[i] = $scope.downloadsLabels[i].replace('_', ', ');
            }
            $scope.downloadsLabels.reverse();
            $scope.ddLabels = [];
            $scope.ddData = [];
            angular.forEach(ddSummaryObj, function(val, key) {
                $scope.ddSummary.push({
                    os: key,
                    count: val,
                });
                $scope.ddData.push(val);
                $scope.ddLabels.push(key);
            });
        });
    };

    /**
     * Builds the years used by the template
     */
    let constructYears = function() {
        let currentYear = moment().year();
        for (let i = 2014; i <= currentYear; i++) {
            $scope.years.push(i);
        }
    };

    /**
     * Handler for duration change watcher
     */
    let onDurationChange = function() {
        if ($scope.duration === 'LIFETIME' || $scope.duration === 'CUSTOM') {
            if ($scope.frequency === 'DAILY') {
                $scope.frequency = 'MONTHLY';
            }
        } else if ($scope.duration === 'YEAR') {
            if ($scope.frequency === 'DAILY' || $scope.frequency === 'YEARLY') {
                $scope.frequency = 'MONTHLY';
            }
        } else if ($scope.duration === 'MONTH') {
            if ($scope.frequency === 'MONTHLY' || $scope.frequency === 'QUARTERLY' ||
                    $scope.frequency === 'YEARLY') {
                $scope.frequency = 'DAILY';
            }
        }
    };

    /**
     * formats a number with commas
     * @param {Number} x
     * @return {String}
     */
    let numberWithCommas = function(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    /**
     * Helper for converting to a number, and ensuring 2 decimal places
     * @param {Number} x
     * @return {Number}
     */
    let fixedNumber = function(x) {
        return Number((x).toFixed(2));
    };

    /**
     * Helper for formating numbers
     * @param {Number}
     * @return {String}
     */
    let format = function(x) {
        if (x === undefined) {
            return x;
        }
        x = fixedNumber(x);
        x = numberWithCommas(x);
        x = $scope.currencySymbol + '' + x;
        return x;
    };

    $scope.$watch('duration', function() {
        onDurationChange();
    });
    init(); // force constructor calls
});

