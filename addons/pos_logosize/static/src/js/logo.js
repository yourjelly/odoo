openerp.pos_logosize = function(instance){
    var module = instance.point_of_sale;

    var models = module.PosModel.prototype.models;

    for (var i = 0; i < models.length; i++ ) {
        var model = models[i];
        if (model.label === 'pictures') {
            var loaded = model.loaded;
            model.loaded = function(self) { 
                return loaded(self).then(function(){
                    var img = self.company_logo;
                    var ratio = 1;
                    var targetwidth = 300;
                    var maxheight = self.config.receipt_logo_size || 150;
                    if( img.width !== targetwidth ){
                        ratio = targetwidth / img.width;
                    }
                    if( img.height * ratio > maxheight ){
                        ratio = maxheight / img.height;
                    }
                    var width  = Math.floor(img.width * ratio);
                    var height = Math.floor(img.height * ratio);
                    var c = document.createElement('canvas');
                        c.width  = width;
                        c.height = height
                    var ctx = c.getContext('2d');
                        ctx.drawImage(self.company_logo,0,0, width, height);

                    self.company_logo_base64 = c.toDataURL();
                });
            };

            return;
        }
    }

};

