"""
generatecriteriajson.py
-------------------

NOTE: Must be run using python3. EG `python3 generateCriteria.py`

A script to generate a criteria.json file to be used as the evaluation criteria
for the hospital data. In the process of reading in the criteria here, the mean
and standard deviation for each metric are calculated.
"""

import json, statistics, re
from rawcriteria import RAW_CRITERIA

def calculateAndAppendDistributions(criteria, data):
    for criterion in criteria:
        if "metric" not in criterion and "components" in criterion:
            calculateAndAppendDistributions(criterion["components"], data)
        elif "metric" in criterion:
            criterion["distribution"] = findDistributionOfMetric(
                criterion["metric"],
                data
            )


def accessValue(datum, keys):
    """
    A helper function which recursively reaches into a datum of possibly nested
    dicts to access a value via the provided list of keys. Each subsequent
    nesting is accessed via that key in the list, IE, the third level of nesting
    is accessed using the third key in the list.
    """

    if keys[0] not in datum:
        return

    if len(keys) == 1:
        try: #  Attempt to strip out non-numeric characters and cast to float
            return float(re.sub(r'[^\d\-.]', '', datum[keys[0]]))
        except ValueError:
            return
    else:
        return accessValue(datum[keys[0]], keys[1:])


def findDistributionOfMetric(metric, data):
    metricPopulation = [
        accessValue(datum, metric)
        for datum in data
        if accessValue(datum, metric) is not None
    ]

    return {
        "mean": statistics.mean(metricPopulation),
        "stdDev": statistics.stdev(metricPopulation)
    }


# -- Script Execution -- #
if __name__ == "__main__":
    # Load in the hospital datafile
    with open("hospitalData.json") as inFile:
        data = json.load(inFile)

    # Calculate the distribution data and append to the CRITERIA variable
    calculateAndAppendDistributions(RAW_CRITERIA, data)

    # Save the JSON file
    with open("ratingCriteria.json", "w") as outFile:
        json.dump(RAW_CRITERIA, outFile)
