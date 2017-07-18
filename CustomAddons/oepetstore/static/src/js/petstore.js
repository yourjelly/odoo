openerp.oepetstore = function(instance, local) {
    var _t = instance.web._t,
        _lt = instance.web._lt;
    var QWeb = instance.web.qweb;

    local.GreetingsWidget = instance.Widget.extend({
    	className: 'oe_petstore_GreetingsWidget',
    	// template:'HomePageTemplate',
    	start: function(){
    		this.$el.append("<div><h3>We are so happy to see you again !!!</h3></div>");
    	},
    });

	local.ProductsWidget = instance.Widget.extend({
        template: "ProductsWidget",
        init: function(parent, products, color) {
            this._super(parent);
            this.products = products;
            this.color = color;
        },
    });
	
	local.ColorInputWidget = instance.Widget.extend({
        template: "ColorInputWidget",
        events: {
            'change input': 'input_changed'
        },
        start: function() {
            this.input_changed();
            return this._super();
        },
        input_changed: function() {
            var color = [
                "#",
                this.$(".oe_color_red").val(),
                this.$(".oe_color_green").val(),
                this.$(".oe_color_blue").val()
            ].join('');
            this.set("color", color);
        },
    });

    local.HomePage = instance.Widget.extend({
    	className: 'oe_petstore_HomePage',
    	template: "HomePage",
    	// template:'HomePageTemplate',
    	// init: function(parent){
    	// 	this._super(parent);
    	// 	this.name = "Kaveri";
    	// },
        start: function() {
        	// // console.log('>>>>>',this.$el);
        	// // this.$el.append(QWeb.render("HomePageTemplate",{name:"Klaus"}));

         //    this.$el.append("<div><h1>Hello dear Odoo user !!</h1></div>");
         //    var greeting = new local.GreetingsWidget(this);
         //    return greeting.appendTo(this.$el);

         // var products = new local.ProductsWidget(
         //        this, ["cpu", "mouse", "keyboard", "graphic card", "screen"], "#00FF00");
         //    products.appendTo(this.$el);

			// this.colorInput = new local.ColorInputWidget(this);
   //          this.colorInput.on("change:color", this, this.color_changed);
   //          return this.colorInput.appendTo(this.$el);
   //      },

   //      color_changed: function() {
   //          this.$(".oe_color_div").css("background-color", this.colorInput.get("color"));
   //      },
		
   			// return new local.MessageOfTheDay(this).appendTo(this.$el);

			return $.when(
                new local.PetToysList(this).appendTo(this.$('.oe_petstore_homepage_left')),
                new local.MessageOfTheDay(this).appendTo(this.$('.oe_petstore_homepage_right'))
            );

		},
    });

 	local.MessageOfTheDay = instance.Widget.extend({
        template: "MessageOfTheDay",
        start: function() {
            var self = this;
            return new instance.web.Model("oepetstore.message_of_the_day")
                .query(["message"])
                .order_by('-create_date', '-id')
                .first()
                .then(function(result) {
                    self.$(".oe_mywidget_message_of_the_day").text(result.message);
                });
        },
    });

    local.PetToysList = instance.Widget.extend({
        template: 'PetToysList',
        
        start: function () {
            var self = this;
            return new instance.web.Model('product.product')
                .query(['name', 'image'])
                .filter([['categ_id.name', '=', "Pet Toys"]])
                .limit(5)
                .all()
                .then(function (results) {
                    _(results).each(function (item) {
                        self.$el.append(QWeb.render('PetToy', {item: item}));
                    });
                });
        }
    });


    instance.web.client_actions.add('petstore.homepage', 'instance.oepetstore.HomePage');
}
