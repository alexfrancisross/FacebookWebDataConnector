var APP_ID = '<YOUR FACEBOOK APP ID>'; //Facebook APP ID
var LIMIT = 250; //Number of records to bring back at any time
var BASEURL = '<YOUR SERVERNAME>/facebooksearch/' //base url of virtual directory

window.fbAsyncInit = function() {
    FB.init({
        appId: APP_ID, // Tableau Facebook APP ID
        channelUrl: BASEURL + 'channel.html', // Channel File
        status: true, // check login status
        cookie: true, // enable cookies to allow the server to access the session
        xfbml: true // parse XFBML
    });

    FB.Event.subscribe('auth.statusChange', function(response) {
        if (response.status === 'connected') {
            document.getElementById("message").innerHTML += "<br>Connected to Facebook";
            //SUCCESS
            var str = "<input class='btn btn-dark btn-lg' type='button' value='Get User Feed' onclick='getData(\"" + response.authResponse.accessToken + "\");'/></br></br>";
            document.getElementById("status").innerHTML = str;
        } else if (response.status === 'not_authorized') {
            document.getElementById("message").innerHTML += "<br>Failed to Connect";
            //FAILED
        } else {
            document.getElementById("message").innerHTML += "<br>Logged Out";
            //UNKNOWN ERROR
        }
    });
};
//Facbook Login on Single Page as Tableau does not allow popups
function Login() {
    var uri = window.location.href;
    window.top.location = encodeURI("https://www.facebook.com/dialog/oauth?client_id=" + APP_ID + "&redirect_uri=" + uri + "&response_type=token&scope=user_posts,manage_pages,read_insights,user_about_me,user_friends,user_status,user_website,user_education_history,user_photos,user_videos,user_likes,user_relationship_details,user_hometown,user_birthday,email");
}

//gets top level data about page
function getData(access_token) {
    tableau.connectionData = access_token; // set pageInfo as the connection data so we can get to it when we fetch the data
    tableau.connectionName = 'Facebook User Feed' // name the data source. This will be the data source name in Tableau
    tableau.submit();
}

function Logout() {
    FB.logout(function() {
        document.location.reload();
    });
}
(function() {
    //Helper function. Returns property if it exists in data object.
    function ifexists(data, property) {
        var str = property.split('.')[0]; //get top level object

        if (data.hasOwnProperty(str)) {
            var strToRet = data[property.split('.')[0]][property.split('.')[1]]; //return second level object
            return strToRet;
        } else {
            return '';
        }
    }

    var myConnector = tableau.makeConnector();
    myConnector.getColumnHeaders = function() {
        var fieldNames = ['message', 'caption', 'created_time', 'description', 'icon', 'post_id', 'is_expired', 'is_hidden', 'link', 'name', 'picture', 'source', 'status_type', 'subscribed', 'type', 'updated_time', 'application_name', 'application_id', 'from_category', 'from_id', 'from_name', 'Post Shares', 'Post Likes', 'Post Comments (Top Level)'];

        var fieldTypes = ['string', 'string', 'datetime', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'bool', 'string', 'datetime', 'string', 'float', 'string', 'float', 'string', 'float', 'float', 'float'];

        tableau.headersCallback(fieldNames, fieldTypes); // tell tableau about the fields and their types
    };

    myConnector.getTableData = function(lastRecordToken) {
        var access_token = tableau.connectionData;
        var toRet = [];
        var next_page;

        if (lastRecordToken) {
            //set the next page of results
            next_page = lastRecordToken;
        }
		else
		{
			//build string for initial search
			next_page = '/me/feed?fields=likes.limit(1).summary(true), comments.limit(1).summary(true).filter(toplevel), message, caption, created_time, description, icon, id, is_expired, is_hidden, link, name, picture, source, status_type, subscribed, type, updated_time, application, from, shares';
			
		}

        //get page feed data	
        FB.api(next_page, {
            access_token: access_token,
            date_format: 'U', //set time format to unicode so that it works with Tableau
            limit: LIMIT
        }, function(feed_response) {
            //console.log(next_page);
            //console.log(feed_response);

            //if no data then we have finished so return empty list to Tableau
            if (feed_response.data.length == 0) {
                tableau.dataCallback([], lastRecordToken, false);
                return;
            }

            var data = feed_response.data;

            // for each post mash the data into an array of objects
            for (ii = 0; ii < data.length; ++ii) {
                //get total comment count
                var totalComments;
                if (data[ii].comments) {
                    totalComments = data[ii].comments.summary.total_count;
                }

                //get total like count
                var totalLikes;
                if (data[ii].likes) {
                    totalLikes = data[ii].likes.summary.total_count;
                }

                var entry = {
                    'message': data[ii].message,
                    'caption': data[ii].caption,
                    'created_time': new Date(data[ii].created_time * 1000),
                    'description': data[ii].description,
                    'icon': data[ii].icon,
                    'post_id': data[ii].id,
                    'is_expired': data[ii].is_expired,
                    'is_hidden': data[ii].is_hidden,
                    'link': data[ii].link,
                    'name': data[ii].name,
                    'picture': data[ii].picture,
                    'source': data[ii].source,
                    'status_type': data[ii].status_type,
                    'subscribed': data[ii].subscribed,
                    'type': data[ii].type,
                    'updated_time': new Date(data[ii].updated_time * 1000),
                    'application_name': ifexists(data[ii], 'application.name'),
                    'application_id': ifexists(data[ii], 'application.id'),
                    'from_category': ifexists(data[ii], 'from.category'),
                    'from_id': ifexists(data[ii], 'from.id'),
                    'from_name': ifexists(data[ii], 'from.name'),
                    'Post Shares': ifexists(data[ii], 'shares.count'),
                    'Post Likes': totalLikes,
                    'Post Comments (Top Level)': totalComments
                };
                toRet.push(entry);
            };
            var paging_next = feed_response.paging.next; //set next page string
            // Call back to tableau with the table data
            tableau.dataCallback(toRet, paging_next, true);
        });
    };
    tableau.registerConnector(myConnector);
})();
