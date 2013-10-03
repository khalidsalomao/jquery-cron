/*
 * jQuery gentleSelect plugin (version 0.1.4)
 * http://shawnchin.github.com/jquery-cron
 *
 * Copyright (c) 2010-2013 Shawn Chin.
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Requires:
 * - jQuery
 *
 * Usage:
 *  (JS)
 *
 *  // initialise like this
 *  var c = $('#cron').cron({
 *    initial: '9 10 * * *', # Initial value. default = "* * * * *"
 *    url_set: '/set/', # POST expecting {"cron": "12 10 * * 6"}
 *  });
 *
 *  // you can update values later
 *  c.cron("value", "1 2 3 4 *");
 *
 * // you can also get the current value using the "value" option
 * alert(c.cron("value"));
 *
 *  (HTML)
 *  <div id='cron'></div>
 *
 * Notes:
 * At this stage, we only support a subset of possible cron options.
 * For example, each cron entry can only be digits or "*", no commas
 * to denote multiple entries. We also limit the allowed combinations:
 * - Every minute : * * * * *
 * - Every hour   : ? * * * *
 * - Every day    : ? ? * * *
 * - Every week   : ? ? * * ?
 * - Every month  : ? ? ? * *
 * - Every year   : ? ? ? ? *
 */
(function ($) {
    'use strict';
    var defaults = {
        initial : "* * * * *",
        minuteOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 30,
            columns   : 4,
            rows      : undefined,
            title     : "Minutes Past the Hour"
        },
        timeHourOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 20,
            columns   : 2,
            rows      : undefined,
            title     : "Time: Hour"
        },
        domOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 30,
            columns   : undefined,
            rows      : 10,
            title     : "Day of Month"
        },
        monthOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 100,
            columns   : 2,
            rows      : undefined,
            title     : undefined
        },
        dowOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : undefined,
            columns   : undefined,
            rows      : undefined,
            title     : undefined
        },
        timeMinuteOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 20,
            columns   : 4,
            rows      : undefined,
            title     : "Time: Minute"
        },
        effectOpts : {
            openSpeed      : 400,
            closeSpeed     : 400,
            openEffect     : "slide",
            closeEffect    : "slide",
            hideOnMouseOut : true
        },
        url_set : undefined,
        customValues : undefined,
        onChange: undefined, // callback function each time value changes
        useGentleSelect: false,
		allowIntervalExpression: true // allow additional interval configuration like: "*/5 * * * *"
    };

    // -------  build some static data -------

	var i, j, len;
    // options for minutes in an hour
    var str_opt_mih = "";
    for (i = 0; i < 60; i++) {
        j = (i < 10) ? "0" : "";
        str_opt_mih += "<option value='" + i + "'>" + j +  i + "</option>\n";
    }

    // options for hours in a day
    var str_opt_hid = "";
    for (i = 0; i < 24; i++) {
        j = (i < 10) ? "0" : "";
        str_opt_hid += "<option value='" + i + "'>" + j + i + "</option>\n";
    }

    // options for days of month
	var suffix, str_opt_dom = "";
    for (i = 1; i < 32; i++) {
        if (i === 1 || i === 21 || i === 31) { suffix = "st"; }
        else if (i === 2 || i === 22) { suffix = "nd"; }
        else if (i === 3 || i === 23) { suffix = "rd"; }
        else { suffix = "th"; }
        str_opt_dom += "<option value='" + i + "'>" + i + suffix + "</option>\n";
    }

    // options for months
    var str_opt_month = "";
    var months = ["January", "February", "March", "April",
                  "May", "June", "July", "August",
                  "September", "October", "November", "December"];
    for (i = 0, len = months.length; i < len; i++) {
        str_opt_month += "<option value='" + (i + 1) + "'>" + months[i] + "</option>\n";
    }

    // options for day of week
    var str_opt_dow = "";
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday"];
    for (i = 0, len = days.length; i < len; i++) {
        str_opt_dow += "<option value='" + i + "'>" + days[i] + "</option>\n";
    }

    // options for period
    var str_opt_period = "";
    var periods = ["minute", "hour", "day", "week", "month", "year"];
    for (i = 0, len = periods.length; i < len; i++) {
        str_opt_period += "<option value='" + periods[i] + "'>" + periods[i] + "</option>\n";
    }	
	
    // display matrix
    var toDisplay = {
        "minute" : ["interval"],
        "hour"   : ["interval","mins"],
        "day"    : ["interval","time"],
        "week"   : ["interval","dow", "time"],
        "month"  : ["interval","dom", "time"],
        "year"   : ["dom", "month", "time"]
    };

	var indexToField = [
		"minute",
		"hour",
		"day",
		"month",
		"week"
	];

	var combinations = {
		"minute" : /^(\*\s){4}\*$/,         // "* * * * *"
		"hour"   : /^.\s(\*\s){3}\*$/,      // "? * * * *"
		"day"    : /^(.\s){2}(\*\s){2}\*$/, // "? ? * * *"
		"week"   : /^(.\s){2}(\*\s){2}.$/,	// "? ? * * ?"
		"month"  : /^(.\s){3}\*\s\*$/,		// "? ? ? * *"
		"year"   : /^(.\s){4}\*$/           // "? ? ? ? *"
	};

	var toPosition = {
        "minute" : 0,
        "hour"   : 1,
        "day"    : 2,
        "week"   : 5,
        "month"  : 3,
        "year"   : 0
    };

    // ------------------ internal functions ---------------
    function defined(obj) {
        if (typeof obj == "undefined") { return false; }
        else { return true; }
    }

    function undefinedOrObject(obj) {
        return (!defined(obj) || typeof obj == "object");
    }

	function parseCronRepeatTime(cron_str) {
		var item = {};
		// remove repeated times of the cron
		var d = cron_str.split(" ");
		// find first occurence of repeat time
		var arr;
		for (i = 0, len = d.length; i < len; i++) {
			arr = d[i].split('/');
			// check presence of repeat time
			if (arr.length > 1) {
				// allow only one occurrence of repeat time
				d[i] = arr[0];
				// set repeat time only for the first occurrence
				if (!item.repeatTime){
					item.repeatTime = arr[1];
					item.repeatTimePos = i;
				}
			}
		}
		item.cron_str = cron_str;
		item.cleanedCron = d.join(' ');
		return item;
	}	
		
	function fullCronParser(cron_str) {
		var j, v, tmp, cleanedCron = [], 
            item = {
                valid: false,
                cron_str: cron_str
            };
		var singleRegex = /^((\*(\/\d+)?)|(\d+(,\d+)*))$/;
		// 1. split cron string
		var parts = cron_str.split(" ");
		// 2. sanity check
		if (parts.length != 5) {
			return item;
		}
		// 3. validate and parse repeat time
		for (j = 0; j < parts.length; j++) {
			v = parts[j];
			// validate part
			if (!singleRegex.test(v)) {
				return item;
			}
            
            // repeat time
			if (v.indexOf('/') > 0) {
				tmp = v.split('/');
				// replace the value by a placeholder
				v = '*';	
				// save repeat time values
				item.repeatTime = tmp[1]; 
				item.repeatTimePos = j;
			}		
			// set value
			if (v.indexOf(',') > 0) {
				item[indexToField[j]] = v.split(',');
			} else {
				item[indexToField[j]] = [v];
			}
			// try get main entry type
			if (v === "*") {
				cleanedCron.push ('*');
			} else {
				cleanedCron.push ('x');
			}
		}	
		
		// 4. get main entry type
		if (item.repeatTime) {
			item.cron_type = indexToField[item.repeatTimePos];
			item.valid = true;
		} else {
			tmp = cleanedCron.join(' ');
			for (t in combinations) {
				if (combinations[t].test(tmp)) { 
					item.cron_type = t;
					item.valid = true;
					break;
				}
			}		
		}	

		return item;
	}

    function getCronType(cron_str) {
        // check format of initial cron value
        var valid_cron = /^((\d{1,2}|\*)\s){4}(\d{1,2}|\*)$/;
        // remove repeated times of the cron for validation
		var parsedCron = parseCronRepeatTime(cron_str);
		cron_str = parsedCron.cleanedCron;
		// test cron string
		if (typeof cron_str != "string" || !valid_cron.test(cron_str)) {
            $.error("cron: invalid initial value");
            return undefined;
        }		
        // check actual cron values
        var d = cron_str.split(" ");
        //            mm, hh, DD, MM, DOW
        var minval = [ 0,  0,  1,  1,  0];
        var maxval = [59, 23, 31, 12,  6];
		var v;
        for (i = 0; i < d.length; i++) {
            if (d[i] === "*") { continue; }
            v = parseInt(d[i]);
            if (defined(v) && v <= maxval[i] && v >= minval[i]) { continue; }

            $.error("cron: invalid value found (col "+(i+1)+") in " + cron_str);
            return undefined;
        }

        // determine combination
		var t;
		// 1. try to find repeatTimePosition
		if (parsedCron.repeatTimePos) {
			for (t in combinations) {
				if (parsedCron.repeatTimePos === toPosition[t]) { 
					return t; 
				}
			}
		}

		// 2. try to find normally
		for (t in combinations) {
			if (combinations[t].test(cron_str)) { 
				return t; 
			}
		}
        // unknown combination
        $.error("cron: valid but unsupported cron format. sorry.");
        return undefined;
    }

    function hasError(c, o) {
        if (!defined(getCronType(o.initial))) { return true; }
        if (!undefinedOrObject(o.customValues)) { return true; }
        return false;
    }

    function getCurrentValue(c) {
        var b = c.data("block");
		var min, hour, day, month, dow;
		min = hour = day = month = dow = "*";
		// prepare period repeat time
		var repeatTime = b["period"].find("input.cron-period-repeat").val();
		if (!repeatTime) { repeatTime = 1; }
		
		// prepare period
        var selectedPeriod = b["period"].find("select").val();
        switch (selectedPeriod) {
            case "minute":
				if (repeatTime > 1) { min += "/" + repeatTime; }
                break;

            case "hour":
                min = b["mins"].find("select").val();
				if (repeatTime > 1) { hour += "/" + repeatTime; }
                break;

            case "day":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
				if (repeatTime > 1) { day += "/" + repeatTime; }
                break;

            case "week":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                dow  =  b["dow"].find("select").val();
				if (repeatTime > 1) { dow += "/" + repeatTime; }
                break;

            case "month":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day  = b["dom"].find("select").val();
				if (repeatTime > 1) { month += "/" + repeatTime; }
                break;

            case "year":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day  = b["dom"].find("select").val();
                month = b["month"].find("select").val();
				
                break;

            default:
                // we assume this only happens when customValues is set
                return selectedPeriod;
        }
        return [min, hour, day, month, dow].join(" ");
    }

    // -------------------  PUBLIC METHODS -----------------

    var methods = {
        init : function(opts) {

            // init options
            var options = opts || {}; /* default to empty obj */
            var o = $.extend([], defaults, options);
            var eo = $.extend({}, defaults.effectOpts, options.effectOpts);
            $.extend(o, {
                minuteOpts     : $.extend({}, defaults.minuteOpts, eo, options.minuteOpts),
                domOpts        : $.extend({}, defaults.domOpts, eo, options.domOpts),
                monthOpts      : $.extend({}, defaults.monthOpts, eo, options.monthOpts),
                dowOpts        : $.extend({}, defaults.dowOpts, eo, options.dowOpts),
                timeHourOpts   : $.extend({}, defaults.timeHourOpts, eo, options.timeHourOpts),
                timeMinuteOpts : $.extend({}, defaults.timeMinuteOpts, eo, options.timeMinuteOpts)
            });

            // error checking
            if (hasError(this, o)) { return this; }

            // ---- define select boxes in the right order -----

            var block = [], custom_periods = "", cv = o.customValues;
            if (defined(cv)) { // prepend custom values if specified
                for (var key in cv) {
                    custom_periods += "<option value='" + cv[key] + "'>" + key + "</option>\n";
                }
            }

            block["period"] = $("<span class='cron-period'>"
                    + "Every " 
					+ (o.allowIntervalExpression ? "<input type='number' class='cron-period-repeat' min='1' max='10000' style='width:32px;' step='1' value='1'/> " : "")
					+ "<select name='cron-period'>" + custom_periods
                    + str_opt_period + "</select> </span>")
                .appendTo(this)
                .data("root", this);

			block["interval"] = block["period"].find("input.cron-period-repeat");
			block["interval"].bind("change.cron", event_handlers.periodChanged).data("root", this);
            var select = block["period"].find("select");
            select.bind("change.cron", event_handlers.periodChanged)
                  .data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(eo); }

            block["dom"] = $("<span class='cron-block cron-block-dom'>"
                    + " on the <select name='cron-dom'>" + str_opt_dom
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this);

            select = block["dom"].find("select").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.domOpts); }

            block["month"] = $("<span class='cron-block cron-block-month'>"
                    + " of <select name='cron-month'>" + str_opt_month
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this);

            select = block["month"].find("select").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.monthOpts); }

            block["mins"] = $("<span class='cron-block cron-block-mins'>"
                    + " at <select name='cron-mins'>" + str_opt_mih
                    + "</select> minutes past the hour </span>")
                .appendTo(this)
                .data("root", this);

            select = block["mins"].find("select").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.minuteOpts); }

            block["dow"] = $("<span class='cron-block cron-block-dow'>"
                    + " on <select name='cron-dow'>" + str_opt_dow
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this);

            select = block["dow"].find("select").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.dowOpts); }

            block["time"] = $("<span class='cron-block cron-block-time'>"
                    + " at <select name='cron-time-hour' class='cron-time-hour'>" + str_opt_hid
                    + "</select>:<select name='cron-time-min' class='cron-time-min'>" + str_opt_mih
                    + " </span>")
                .appendTo(this)
                .data("root", this);

            select = block["time"].find("select.cron-time-hour").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.timeHourOpts); }
            select = block["time"].find("select.cron-time-min").data("root", this);
            if (o.useGentleSelect) { select.gentleSelect(o.timeMinuteOpts); }

            block["controls"] = $("<span class='cron-controls'>&laquo; save "
                    + "<span class='cron-button cron-button-save'></span>"
                    + " </span>")
                .appendTo(this)
                .data("root", this)
                .find("span.cron-button-save")
                    .bind("click.cron", event_handlers.saveClicked)
                    .data("root", this)
                    .end();

			this.find("input.cron-period-repeat").bind("change.cron-callback", event_handlers.somethingChanged);
            this.find("select").bind("change.cron-callback", event_handlers.somethingChanged);
            this.data("options", o).data("block", block); // store options and block pointer
            this.data("current_value", o.initial); // remember base value to detect changes

            return methods["value"].call(this, o.initial); // set initial value
        },

        value : function(cron_str) {
            // when no args, act as getter
            if (!cron_str) { return getCurrentValue(this); }

            var t = getCronType(cron_str);
            if (!defined(t)) { return false; }

            var block = this.data("block");
            var d = cron_str.split(" ");
			// find first occurence of repeat time
			var repeatTimeParsedItem = parseCronRepeatTime(cron_str);			
			// parse values
            var v = {
                "mins"  : d[0],
                "hour"  : d[1],
                "dom"   : d[2],
                "month" : d[3],
                "dow"   : d[4]
            };

            // is gentleSelect enabled
            var useGentleSelect = this.data('options').useGentleSelect;

            // update appropriate select boxes
            var targets = toDisplay[t];
			var tgt, btgt;
            for (i = 0, len = targets.length; i < len; i++) {
                tgt = targets[i];				
                if (tgt == "time") {
                    btgt = block[tgt].find("select.cron-time-hour").val(v["hour"]);
                    if (useGentleSelect) { btgt.gentleSelect("update"); }

                    btgt = block[tgt].find("select.cron-time-min").val(v["mins"]);
                    if (useGentleSelect) { btgt.gentleSelect("update"); }
                } else if (tgt == "interval") {
					continue;
				} else {
                    btgt = block[tgt].find("select").val(v[tgt]);
                    if (useGentleSelect) { btgt.gentleSelect("update"); }
                }
            }
			
			// set repeat time (note: this is just an initial approximation!)
			if (repeatTimeParsedItem.repeatTime) {
				block["period"].find("input.cron-period-repeat").val(repeatTimeParsedItem.repeatTime);
			}

            // trigger change event
            var bp = block["period"].find("select").val(t);
            if (useGentleSelect) { bp.gentleSelect("update"); }
            bp.trigger("change");

            return this;
        }

    };

    var event_handlers = {
        periodChanged : function() {
            var root = $(this).data("root");
            var block = root.data("block"),
                opt = root.data("options");
            var period = $(this).val();
			// deal with change on period repeat field
			if (this.className === "cron-period-repeat") {
				period = block["period"].find("select").val();
			}
			// update display
            root.find("span.cron-block").hide(); // first, hide all blocks
			block["interval"].hide();
			var b;
            if (toDisplay.hasOwnProperty(period)) { // not custom value
                b = toDisplay[period];
                for (i = 0, len = b.length; i < len; i++) {
                    block[b[i]].show();
                }
            }
        },

        somethingChanged : function() {
            var root = $(this).data("root");
            // if AJAX url defined, show "save"/"reset" button
            if (defined(root.data("options").url_set)) {
                if (methods.value.call(root) != root.data("current_value")) { // if changed
                    root.addClass("cron-changed");
                    root.data("block")["controls"].fadeIn();
                } else { // values manually reverted
                    root.removeClass("cron-changed");
                    root.data("block")["controls"].fadeOut();
                }
            } else {
                root.data("block")["controls"].hide();
            }

            // chain in user defined event handler, if specified
            var oc = root.data("options").onChange;
            if (defined(oc) && $.isFunction(oc)) {
                oc.call(root);
            }
        },

        saveClicked : function() {
            var btn  = $(this);
            var root = btn.data("root");
            var cron_str = methods.value.call(root);

            if (btn.hasClass("cron-loading")) { return; } // in progress
            btn.addClass("cron-loading");

            $.ajax({
                type : "POST",
                url  : root.data("options").url_set,
                data : { "cron" : cron_str },
                success : function() {
                    root.data("current_value", cron_str);
                    btn.removeClass("cron-loading");
                    // data changed since "save" clicked?
                    if (cron_str == methods.value.call(root)) {
                        root.removeClass("cron-changed");
                        root.data("block").controls.fadeOut();
                    }
                },
                error : function() {
                    alert("An error occured when submitting your request. Try again?");
                    btn.removeClass("cron-loading");
                }
            });
        }
    };

    $.fn.cron = function(method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || ! method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.cron' );
        }
    };

})(jQuery);
