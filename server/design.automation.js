// token handling in session
var token = require('./token');

var token = require('./token');

// web framework
var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var zlib = require("zlib");



// forge SDK
var forgeSDK = require('forge-apis');
var itemsApi = new forgeSDK.ItemsApi();
var workItemsApi = new forgeSDK.WorkItemsApi;
var objectsApi = new forgeSDK.ObjectsApi;
var activitiesApi = new forgeSDK.ActivitiesApi;

// web framework

router.use(bodyParser.urlencoded({ extended: true }));
router.post('/submitWorkItem', jsonParser, function (req, res) {
    if (!req.body.projectId || !req.body.itemId) {
        res.json({ success: false, message: 'Could not find project ID and item ID.' });
    } else {
        var tokenSession = new token(req.session);
        if (!tokenSession.isAuthorized()) {
            res.status(401).end('Please login first');
            return;
        }
        var href = decodeURIComponent(req.header('wip-href'))
        var params = href.split('/');
        var projectId = params[params.length - 3];
        var versionId = params[params.length - 1];
        getItem(req.body.projectId, versionId, req.body.itemId, req.body.fileName, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials(), res);
        res.end;
    }
});

/**
 * 
 */
router.get('/getWorkItemStatus',jsonParser,function(req,res){
    if(!req.query.workItemId){
    res.json({ success: false, message: 'Could not find workItemId' });
    }
    else{
        let workItemId = req.query.workItemId;
        var tokenSession = new token(req.session);
        if (!tokenSession.isAuthorized()) {
            res.status(401).end('Please login first');
            return;
        }
     getWorkItemStatus(workItemId, tokenSession.getInternalCredentials(), function (status, workitemResult) {
        var report = "";
        if (status) {
            // Process the output from the workitem on success
            var output = workitemResult.Arguments.OutputArguments[0].Resource;
            console.log("Process the output from the workitem on success\n");
            console.log(output + "\n");
            console.log("Display the workitem repory \n");
            report = workitemResult.StatusDetails.Report;
            console.log(report);
        } else {
            console.log(" On error, display the workitem report if available");
            report = workitemResult.StatusDetails.Report;
            if (workitemResult && report) {
                console.log("Error processing the workitem");
                console.log(report);
                //downloadFile(errorReport, 'log');
            }
            console.log(report);
        }
        console.log(report);
        res.json({success:true, reportLog:report, reportPDF:output});
    });
    res.end;
}

});

module.exports = router;

function getItem(projectId, versionId, itemId, fileName, oauthClient, credentials, res) {
    itemsApi.getItem(projectId, itemId, oauthClient, credentials)
        .then(function (item) {
            if (item.body.included) {
                for (var key in item.body.included) {
                    var ossUrl = item.body.included[key].relationships.storage.meta.link.href;
                    console.log('Got the OSS url ...' + ossUrl);
                    var displayName = item.body.included[key].attributes.displayName;
                    console.log('Display Name of file...' + displayName);
                    var folderId = item.body.data.relationships.parent.data.id;
                    console.log('Display folderId of file...' + folderId);                   
                    submitWorkItem(ossUrl,oauthClient, credentials)
                    .then(function (workItemResp) {
                            console.log("*** workitem post response:", workItemResp.body);
                            var workItemId = workItemResp.body.Id;
                            res.json({ success: true, message: 'Submitted WorkItem Successfully!', workItemId:workItemId});
                        }, function (err) {
                            console.error(err);
                            res.json({ success: false, message: 'Submitted WorkItem Failed!'});
                        });                    
                    break;
                }
            } else {
                res.json({ success: false, message: 'No storage href returned.' });
            }
        })
        .catch(console.log.bind(console));
}

/**
 * Gets the details of a bucket specified by a bucketKey.
 * Uses the oAuth2TwoLegged object that you retrieved previously.
 * @param bucketKey
 */
var getBucketDetails = function (bucketKey) {
    console.log("**** Getting bucket details : " + bucketKey);
    return bucketsApi.getBucketDetails(bucketKey, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials());
};

/**
 * Create a new bucket.
 * Uses the oAuth2TwoLegged object that you retrieved previously.
 * @param bucketKey
 */
var createBucket = function (bucketKey) {
    console.log("**** Creating Bucket : " + bucketKey);
    var createBucketJson = { 'bucketKey': bucketKey, 'policyKey': 'transient' };
    return bucketsApi.createBucket(createBucketJson, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials());
};


/**
 * This function first makes an API call to getBucketDetails endpoint with the provided bucketKey.
 * If the bucket doesn't exist - it makes another call to createBucket endpoint.
 * @param bucketKey
 * @returns {Promise - details of the bucket in Forge}
 */
var createBucketIfNotExist = function (bucketKey) {
    console.log("**** Creating bucket if not exist :", bucketKey);

    return new Promise(function (resolve, reject) {
        getBucketDetails(bucketKey).then(function (resp) {
            resolve(resp);
        },
            function (err) {
                if (err.statusCode === 404) {
                    createBucket(bucketKey).then(function (res) {
                        resolve(res);
                    },
                        function (err) {
                            reject(err);
                        })
                }
                else {
                    reject(err);
                }
            });
    });
};
function attachVersionToAnotherVersion(projectId, versionId, attachmentVersionId, oauthClient, credentials) {
    return new Promise(function (_resolve, _reject) {


        // Ask for storage for the new file we want to upload
        var versions = new forgeSDK.VersionsApi();
        var body = attachmentSpecData(attachmentVersionId, projectId);
        versions.postVersionRelationshipsRef(projectId, versionId, body, oauthClient, credentials)
            .then(function () {
                _resolve();
            })
            .catch(function (error) {
                console.log('postVersionRelationshipsRef: failed');
                _reject(error);
            });
    });
}
function itemSpecData(fileName, projectId, folderId, objectId) {
    var itemsType = projectId.startsWith("a.") ? "items:autodesk.core:File" : "items:autodesk.bim360:File";
    var versionsType = projectId.startsWith("a.") ? "versions:autodesk.core:File" : "versions:autodesk.bim360:File";
    var itemSpec = {
        jsonapi: {
            version: "1.0"
        },
        data: {
            type: "items",
            attributes: {
                displayName: fileName,
                extension: {
                    type: itemsType,
                    version: "1.0"
                }
            },
            relationships: {
                tip: {
                    data: {
                        type: "versions",
                        id: "1"
                    }
                },
                parent: {
                    data: {
                        type: "folders",
                        id: folderId
                    }
                }
            }
        },
        included: [{
            type: "versions",
            id: "1",
            attributes: {
                name: fileName,
                extension: {
                    type: versionsType,
                    version: "1.0"
                }
            },
            relationships: {
                storage: {
                    data: {
                        type: "objects",
                        id: objectId
                    }
                }
            }
        }]
    };

    if (fileName.endsWith(".iam.zip")) {
        itemSpec.data[0].attributes.extension.type = "versions:autodesk.a360:CompositeDesign";
        itemSpec.data[0].attributes.name = fileName.slice(0, -4);
        itemSpec.included[0].attributes.name = fileName.slice(0, -4);
    }

    console.log(itemSpec);

    return itemSpec;
}

function versionSpecData(fileName, projectId, itemId, objectId) {
    var versionsType = projectId.startsWith("a.") ? "versions:autodesk.core:File" : "versions:autodesk.bim360:File";

    var versionSpec = {
        "jsonapi": {
            "version": "1.0"
        },
        "data": {
            "type": "versions",
            "attributes": {
                "name": fileName,
                "extension": {
                    "type": versionsType,
                    "version": "1.0"
                }
            },
            "relationships": {
                "item": {
                    "data": {
                        "type": "items",
                        "id": itemId
                    }
                },
                "storage": {
                    "data": {
                        "type": "objects",
                        "id": objectId
                    }
                }
            }
        }
    }

    if (fileName.endsWith(".iam.zip")) {
        versionSpec.data.attributes.extension.type = "versions:autodesk.a360:CompositeDesign";
        versionSpec.data.attributes.name = fileName.slice(0, -4);
    }

    console.log(versionSpec);

    return versionSpec;
}
function createNewItemVersion(projectId, folderId, fileName, objectId, oauthClient, credentials) {
    return new Promise(function (_resolve, _reject) {     

        var folders = new forgeSDK.FoldersApi();
        folders.getFolderContents(projectId, folderId, {}, oauthClient, credentials)
            .then(function (folderData) {
                var item = null;
                for (var key in folderData.body.data) {
                    item = folderData.body.data[key];
                    if (item.attributes.displayName === fileName) {
                        break;
                    } else {
                        item = null;
                    }
                }

                if (item) {
                    // We found it so we should create a new version
                    var versions = new forgeSDK.VersionsApi();
                    var body = versionSpecData(fileName, projectId, item.id, objectId);
                    versions.postVersion(projectId, body, oauthClient, credentials)
                        .then(function (versionData) {
                            _resolve(versionData.body.data.id);
                        })
                        .catch(function (error) {
                            console.log('postVersion: failed');

                            _reject(error);
                        });
                } else {
                    // We did not find it so we should create it
                    var items = new forgeSDK.ItemsApi();
                    var body = itemSpecData(fileName, projectId, folderId, objectId);
                    items.postItem(projectId, body, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials())
                        .then(function (itemData) {
                            // Get the versionId out of the reply
                            _resolve(itemData.body.included[0].id);
                        })
                        .catch(function (error) {
                            console.log('postItem: failed');

                            _reject(error);
                        });
                }
            })
            .catch(function (error) {
                console.log('getFolderContents: failed');
                _reject(error);
            });
    });
}
function getFolderId(projectId, versionId, req) {
    return new Promise(function (_resolve, _reject) {
        // Figure out the itemId of the file we want to attach the new file to
        var tokenSession = new token(req.session);

        var versions = new forgeSDK.VersionsApi();

        versions.getVersion(projectId, versionId, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials())
            .then(function (versionData) {
                var itemId = versionData.body.data.relationships.item.data.id;

                // Figure out the folderId of the file we want to attach the new file to
                var items = new forgeSDK.ItemsApi();
                items.getItem(projectId, itemId, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials())
                    .then(function (itemData) {
                        var folderId = itemData.body.data.relationships.parent.data.id;

                        _resolve(folderId);
                    })
                    .catch(function (error) {
                        console.log(error);
                        _reject(error);
                    });
            })
            .catch(function (error) {
                console.log(error);
                _reject(error);
            });
    });
}
function getBucketKeyObjectName(objectId) {
    // the objectId comes in the form of
    // urn:adsk.objects:os.object:BUCKET_KEY/OBJECT_NAME
    var objectIdParams = objectId.split('/');
    var objectNameValue = objectIdParams[objectIdParams.length - 1];
    // then split again by :
    var bucketKeyParams = objectIdParams[objectIdParams.length - 2].split(':');
    // and get the BucketKey
    var bucketKeyValue = bucketKeyParams[bucketKeyParams.length - 1];

    var ret = {
        bucketKey: bucketKeyValue,
        objectName: objectNameValue
    };

    return ret;
}

function storageSpecData(fileName, folderId) {
    var storageSpecs = {
        jsonapi: {
            version: "1.0"
        },
        data: {
            type: 'objects',
            attributes: {
                name: fileName
            },
            relationships: {
                target: {
                    data: {
                        type: 'folders',
                        id: folderId
                    }
                }
            }
        }
    };

    console.log(storageSpecs);

    return storageSpecs;
}

function getBucketUrl(projectId, folderId, fileName, oauthClient, credentials) {
    return new Promise(function (_resolve, _reject) {
        var projects = new forgeSDK.ProjectsApi();
        var body = storageSpecData(fileName, folderId);
        projects.postStorage(projectId, body, oauthClient, credentials)
            .then(function (storageData) {
                var objectId = storageData.body.data.id;
                var bucketKeyObjectName = getBucketKeyObjectName(objectId);
                var bucketKey = bucketKeyObjectName.bucketKey;
                var objectName = bucketKeyObjectName.objectName
                var bucketURL = "https://developer.api.autodesk.com/oss/v2/buckets/" + bucketKey + "/objects/" + objectName;
                var ret = {
                    bucketURL: bucketURL,
                    objectId: objectId,
                    objectName: objectName
                };
                _resolve(ret);
            })
            .catch(function (error) {
                console.log('postStorage: failed');
                _reject(error);
            });
    });
}

/**
 * creates the Activity
 */
function createOrUpdateActivity(oauthClient,credentials){
    console.log("*****Creating Activity***")
    let bearerAccessToken = credentials;
    bearerAccessToken = bearerAccessToken.token_type + " " + bearerAccessToken.access_token;
    var createActivityJson = {
        "Id": "CAT2DWG",
        "AppPackages": [],
        "HostApplication": "AcTranslators.exe",
        "RequiredEngineVersion": "22.0",
        "Parameters": {
            "InputParameters": [
                {
                    "Name": "HostDwg",
                    "LocalFileName": "source.CATPart"
                }
            ],
            "OutputParameters": [
                {
                    "Name": "Result",
                    "LocalFileName": "result.dwg"
                }
            ]
        },
        "Instruction": {
            "CommandLineParameters": "-i source.CATPart -o result.dwg",
            "Script": ""
        },
        "AllowedChildProcesses": [
        ],
        "IsPublic": true,
        "Version": 1,
        "Description": ""
    }
    return activitiesApi.createActivity(createActivityJson,oauthClient,credentials);
}

/**
 * creates  the workItem from download url supplied by OSS.
 * Uses the oAuth2ThreeLegged object that you retrieved previously.
 * @param ossUrl
 * @param oauthClient
 * @param credentials
 * @returns {}
 */
function submitWorkItem(ossUrl, oauthClient, credentials) {

    console.log("*****Posting Workitem\n*********");
    let bearerAccessToken = credentials;
    bearerAccessToken = bearerAccessToken.token_type + " " + bearerAccessToken.access_token;


    var workItemJson = {
        "Arguments": {
            "InputArguments": [{
                "Resource": ossUrl,
                "Name": "HostDwg",
                "Headers": [{ "Name": "Authorization", "Value": bearerAccessToken }]
            }],
            "OutputArguments": [{
                "Name": "Result", 
                "HttpVerb": "POST",                
                "StorageProvider": "Generic"
               }]
        }, 
        "ActivityId": "CAT2DWG", 
        "Id": ""
    };

    return workItemsApi.createWorkItem(workItemJson, oauthClient, credentials);
}

 


/**
 * polls  the workItem by id
 * Uses the oAuth2ThreeLegged object that you retrieved previously.
 * @param workItemId
 * 
 */
var pollWorkItem = function (workItemId, oauthClient, credentials) {
    console.log("*****Polling Workitem\n*********");
    return workItemsApi.getWorkItem(workItemId, oauthClient, credentials);
};

var asyncLoop = function (o) {
    var loop = function () {
        o.functionToInvoke(loop);
    }
    loop();
}

// The function polls the workitem status, in a while loop, 
// the loop breaks on success or error. 
//
function getWorkItemStatus(workitemId, credentials, callback) {
    var request = require("request");
    var workitemstatusurl = "https://developer.api.autodesk.com//autocad.io/us-east/v2/WorkItems";
    var _url = workitemstatusurl + "(%27" + workitemId + "%27)"; /*"?workitemid=" + encodeURIComponent(workitemId);*/
    let bearerAccessToken = credentials;
    bearerAccessToken = bearerAccessToken.token_type + " " + bearerAccessToken.access_token;
    var options = {
        method: 'GET',
        url: _url,
        headers:
        {
            'content-type': 'application/json',
            authorization: bearerAccessToken
        }
    };
    asyncLoop({
        functionToInvoke: function (loop) {
            setTimeout(function () {
                request(options, function (error, response, body) {
                    var result = JSON.parse(body);
                    if (response && response.statusCode) {
                        if (result && (result.Status === "Pending" || result.Status ==="InProgress")) {
                            // continue if the status is Pending or InProgress
                            loop();
                        } else if (result && result.Status === "Succeeded") {
                            callback(true, result);
                        }
                        else {
                            console.log("It is not pending\\inprogres\\succeeded\n");
                            console.log(result.Status+"\n"+result);                            
                            callback(false, result);
                        }
                    } else {
                        callback(false, result);
                    }
                });
            }, 2000);
        }
    });
}






var path = require('path');

function replaceExt(npath, ext) {
    if (typeof npath !== 'string') {
        return npath;
    }

    if (npath.length === 0) {
        return npath;
    }

    var nFileName = path.basename(npath, path.extname(npath)) + ext;
    return path.join(path.dirname(npath), nFileName);
}

var downloadPdfToDisk = function (url, filename) {
    var https = require('https');
    var fs = require('fs');
    //trim spaces in filename
    var oldpath = './drawings/' + filename.replace(/\s/g, '');
    //replace dwg with pdf
    var newPath = replaceExt(oldpath, '.pdf');
    var file = fs.createWriteStream(newPath);
    var request = https.get(url, function (response) {
        response.pipe(file);
    });
};


