"""
rawcriteria.py
--------------

The criteria available for rating hospitals, before attaching the information
about the distribution of the values.

Each criterion is a dict including at least a 'name' and 'weight' key. A
criterion must also include either a 'components' (a list of other critera) key
or both a 'metric' (a list of strings specifying the keys to use to look up a
metric from the data) and an 'invert' (a boolean: False indicates that a higher
value is better, True, the inverse) key.

Schematically:

criteria = [
    # -- Criterion Form 1
    {
        "name": String,
        "weight": Number,
        "components": [
            ... # Other criteria ...
        ]
    },

    # -- Criterion Form 2
    {
        "name": String,
        "weight": Number,
        "metric": [String]
        "invert": Boolean
    }
]
"""


RAW_CRITERIA = [

    # -- PATIENT COMFORT -- #

    {
        "name": "Comfort",
        "weight": 1.0,
        "components": [
            {
                "name": "Patients' Overall Rating of Hospital",
                "weight": 1.0,
                "metric":  ["StarRatings", "H_HSP_RATING_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Rating of Cleanliness",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_CLEAN_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Rating of Nurse Communication",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_COMP_1_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Rating of Doctor Communication",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_COMP_2_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Rating of Staff Responsiveness",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_COMP_3_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Rating of Pain Management",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_COMP_4_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Rating of Communication about Medicine",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_COMP_5_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Rating of Information on Discharge",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_COMP_6_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Rating of Care Transition",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_COMP_7_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Rating of Hospital Quietness",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_COMP_7_STAR_RATING"],
                "invert": False,
            },
            {
                "name": "Patients' Would Recommend",
                "weight": 0.0,
                "metric":  ["StarRatings", "H_RECMND_STAR_RATING"],
                "invert": False,
            }
        ]
    },

    # -- QUALITY OF CARE -- #

    {
        "name": "Quality",
        "weight": 1.0,
        "components": [
            {
                "name": "Hospital-Wide 30-Day Readmission",
                "weight": 1.0,
                "metric": ["ReadmissionsAndDeaths", "READM_30_HOSP_WIDE"],
                "invert": True
            },
            {
                "name": "Heart Attack Care Quality",
                "weight": 0.0,
                "components": [
                    {
                        "name": "Heart Attack 30-Day Mortality",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "MORT_30_AMI"],
                        "invert": True
                    },
                    {
                        "name": "Heart Attack 30-Day Readmission",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "READM_30_AMI"],
                        "invert": True
                    }
                ]
            },
            {
                "name": "Coronary Heart Disease Care Quality",
                "weight": 0.0,
                "components": [
                    {
                        "name": "Coronary Artery Bypass Grafting 30-Day Mortality",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "MORT_30_CABG"],
                        "invert": True
                    },
                    {
                        "name": "Coronary Artery Bypass Grafting 30-Day Readmission",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "READM_30_CABG"],
                        "invert": True
                    }
                ]
            },
            {
                "name": "Chronic Obstructive Pulmonary Disease Care Quality",
                "weight": 0.0,
                "components": [
                    {
                        "name": "Chronic Obstructive Pulmonary Disease 30-Day Mortality",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "MORT_30_COPD"],
                        "invert": True
                    },
                    {
                        "name": "Chronic Obstructive Pulmonary Disease 30-Day Readmission",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "READM_30_COPD"],
                        "invert": True
                    }
                ]
            },
            {
                "name": "Heart Failure Care Quality",
                "weight": 0.0,
                "components": [
                    {
                        "name": "Heart Failure 30-Day Mortality",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "MORT_30_HF"],
                        "invert": True
                    },
                    {
                        "name": "Heart Failure 30-Day Readmission",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "READM_30_HF"],
                        "invert": True
                    }
                ]
            },
            {
                "name": "Pneumonia Care Quality",
                "weight": 0.0,
                "components": [
                    {
                        "name": "Pneumonia 30-Day Mortality",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "MORT_30_PN"],
                        "invert": True
                    },
                    {
                        "name": "Pneumonia 30-Day Readmission",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "READM_30_PN"],
                        "invert": True
                    }
                ]
            },
            {
                "name": "Stroke Care Quality",
                "weight": 0.0,
                "components": [
                    {
                        "name": "Stroke 30-Day Mortality",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "MORT_30_STK"],
                        "invert": True
                    },
                    {
                        "name": "Stroke 30-Day Readmission",
                        "weight": 1.0,
                        "metric": ["ReadmissionsAndDeaths", "READM_30_STK"],
                        "invert": True
                    }
                ]
            },
            {
                "name": "Hip/Knee Surgery Quality",
                "weight": 0.0,
                "metric": ["ReadmissionsAndDeaths", "READM_30_HIP_KNEE"],
                "invert": True
            }
        ]
    },

    # -- AFFORDABILITY -- #

    {
        "name": "Affordability",
        "weight": 1.0,
        "components": [
            {
                "name": "Affordability for Heart Attack Patients",
                "weight": 1.0,
                "metric": ["Payment", "PAYM_30_AMI"],
                "invert": True
            },
            {
                "name": "Affordability for Heart Failure Patients",
                "weight": 1.0,
                "metric": ["Payment", "PAYM_30_HF"],
                "invert": True
            },
            {
                "name": "Affordability for Pneumonia Patients",
                "weight": 1.0,
                "metric": ["Payment", "PAYM_30_PN"],
                "invert": True
            }
        ]
    }
]
