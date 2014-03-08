UniQ

==========

a simple node base service to generate unique identifiers safely.

Installation:

- clone or download this repository to where you want it
- get node.js 
- needs restifiy:  npm install restifiy
- open UniQ.js: adjust configuration on top of file
- run "node UniQ.js" in the root directory


Usage:

send a http call to http://localhost:8080/<namespace> to retrieve a new unique identifier for the given namespace
(namespaces can be added in the configuration. url and port can be change there too)
You will get a json array with a new value or a json object with a 'error' key on failure.
