module.exports = function ( results ) {
    var results = results || [ ];

    var summary = results.reduce( function ( seq, current ) {

        current.messages.forEach( function ( msg ) {
            var logMessage = {
                filePath: current.filePath,
                ruleId: msg.ruleId,
                message: msg.message,
                line: msg.line,
                column: msg.column,
                errorCount: current.errorCount,
                warningCount: current.warningCount
            };

            if ( msg.severity === 1 ) {
                logMessage.type = 'warning';
                seq.warnings.push( logMessage );
            }
            if ( msg.severity === 2 ) {
                logMessage.type = 'error';
                seq.errors.push( logMessage );
            }
        } );
        return seq;
    }, {
        errors: [],
        warnings: []
    } );

    if ( summary.errors.length > 0 || summary.warnings.length > 0 ) {
        var lines = summary.errors.concat( summary.warnings ).map( function ( msg ) {
            return '\n' + msg.type + ' ' + msg.ruleId + '\n  ' + msg.filePath + ':' + msg.line + ':' + msg.column;
        } ).join( '\n' );

        return lines + '\n' +'Errors: ' + summary.errors.length + ', Warnings: ' + summary.warnings.length + '\n';
    }
};