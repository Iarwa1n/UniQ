/**
 * Configuration area
 */
var config = {
    storage_path : '/tmp/',
    namespaces:
        {
            'object1' : {prefix: 'o1_' , type: 'hash', 'length' : 20, postfix: '' },
            'object2' : {prefix: 'o2_' , type: 'hash', 'length' : 2, postfix: '_id' }
        },
     
     }



var restify = require('restify');
var fs = require('fs');
var crypto = require('crypto');

var server = restify.createServer({
    name: 'myapp',
    version: '1.0.0'
});

var IdentifierGenerator = function(config)
    {
        var namespaces = config['namespaces'];
        var lower_bound = 5;

        //sanitize namespace values
        
        for (namespace in namespaces) {
            namespaces[namespace]['name']  = namespace;
            namespaces[namespace]['prefix']  = namespaces[namespace]['prefix'] || '';
            namespaces[namespace]['postfix'] = namespaces[namespace]['postfix'] || '';
            namespaces[namespace]['type'] = namespaces[namespace]['type'] || 'hash';
            namespaces[namespace]['length'] = parseInt(namespaces[namespace]['length']) || 32;
            namespaces[namespace]['file'] = config['storage_path'] + namespace + '.existing';
            namespaces[namespace]['unused'] = [];
        }
        
        /**
         * generates a random alphanumeric hash of the given length
         * @param int length   the length of the hash
         * @return string   a string with alphanumeric characters of the requested length (lowercase only for now)
         */
        var generateHash = function(length)
        {
            var chars = 'abcdefghijklmnopqrstuvwxyz01234567890';
            var result = '';
            for (var i = length; i > 0; --i) {
                result += chars[Math.round(Math.random() * (chars.length - 1))];
            }
            return result.toLowerCase();
        };
        
        /**
         * retrieves a new identififer for the requested namespace
         * @param string namespace the name of the requested namespace
         * @returns {Boolean|Object} false if an error occurs, otherwise the next value
         */
        this.next = function(namespace) 
        {
            if (!namespaces[namespace]) {
                console.log(namespace + ' is an unknown namespace');
                return false;
            }
            namespace = namespaces[namespace];
            if (namespace.out_of_bounds === true) {
                return false;
            }
            if (namespace.unused.length < lower_bound) {
                generateUnused(namespace, (namespace.unused.length === 0));
            }
            var value = namespace.unused.shift();
            storeExisting(namespace,value);
            
            return namespace['prefix']  + value + namespace['postfix'];
        };


        /**
         * creates new usable values for the given namespace
         * @param object namespace the namespace who defines the rules for generation
         * @param array existing a list of all existing values up to now
         * @return array the new usable values
         */
        var createNewUsable = function(namespace, existing)
        {
            var generate_count = 10;
            switch(namespace['type']) {
                case 'hash':
                    var max_fail_count = 1000;
                    var fail_count = 0;
                    for (var i=0; i < generate_count; ++i) {
                        var value = generateHash(namespace['length']);

                        if (existing.indexOf(value) > -1  || namespace.unused.indexOf(value) > -1) {
                            --i;
                            ++fail_count;
                        } else {
                            namespace.unused.push(value);
                        }
                        if (fail_count >= max_fail_count) {
                            console.log("-- OUF OF BOUNDS for " + namespace['name'] + " --");
                            namespace["out_of_bounds"] = true;
                            break;
                        }
                    }
                    break;
                default:
                    console.log("unknown namespace type: " + namespace['type']);
                    break;
            }
            return namespace.unused;
        }
        
        /**
         * generate new usable values for the given namespace and write them into this.unused
         * @param Object namespace  the namespace to generate values for
         * @param boolean forceSync if true the values will ne generated synchronous
         */
        var generateUnused = function(namespace, forceSync)
        {
            var existing = [];
            if (fs.existsSync(namespace['file'])) {
                if (forceSync === true) {
                    console.log("load sync forced");
                    var data = fs.readFileSync(namespace['file'], 'utf8');
                    existing = data.split("\n");    
                    createNewUsable(namespace, existing);
                } else {
                    console.log("load async");
                    var data = fs.readFile(namespace['file'], 'utf8', 
                        function(err, data) {
                            if(err) {
                                console.log(err);
                                return;
                            }
                            existing = data.split("\n");    
                            createNewUsable(namespace, existing)
                        });
                }
            } else {
                console.log("load sync");
                createNewUsable(namespace, existing);
            }
        };
        
        /**
         * stores a used value to the filesystem asynchronously
         * @param object namespace   the namespace to asave the value to
         * @param string value  the raw value to be saved
         */
        var storeExisting = function(namespace, value)
        {
            fs.appendFile(namespace['file'], value + "\n", function (err) {
                if(err) {
                    console.log("error storing value " + value + " for namespace " + namespace['name'] + " to filesystem: ");
                    console.log(err);
                }
            });            
        };
    };


var generator = new IdentifierGenerator(config);

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.get('/:namespace', function(req, res, next) {
    var x = generator.next(req.params.namespace);
    if (!x) {
        res.send({'error' : 'could not retrieve new value'});
        return next();
    }
    res.send([x]);
    return next();
});


server.listen(8080, function () {
    console.log('%s listening at %s', server.name, server.url);
});