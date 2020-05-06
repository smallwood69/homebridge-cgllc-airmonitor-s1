const miio = require('miio');
let Service, Characteristic;
let devices = [];

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-cgllc-airmonitor-s1', 'ClearGrassAirMonitor', ClearGrassAirMonitor);
}

function ClearGrassAirMonitor(log, config) {
    this.log = log;
    this.ip = config.ip;
    this.token = config.token;
    this.name = config.name || 'Xiaomi Clear Grass';
    this.showAirQuality = config.showAirQuality || false;
    this.showTemperature = config.showTemperature || false;
    this.showHumidity = config.showHumidity || false;
    this.showCo2 = config.showCo2 || false;

    this.nameAirQuality = config.nameAirQuality || 'Air Quality';
    this.nameTemperature = config.nameTemperature || 'Temperature';
    this.nameHumidity = config.nameHumidity || 'Humidity';
    this.nameCo2 = config.nameCo2 || 'Co2';

    this.device = null;
    this.mode = null;
    this.temperature = null;
    this.humidity = null;
    this.tvoc = null;
    this.aqi = null;
    this.co2 = null;

    this.aqiLevels = [
        [200, Characteristic.AirQuality.POOR],
        [150, Characteristic.AirQuality.INFERIOR],
        [100, Characteristic.AirQuality.FAIR],
        [50, Characteristic.AirQuality.GOOD],
        [0, Characteristic.AirQuality.EXCELLENT],
    ];

    this.services = [];

    if (!this.ip) {
        throw new Error('Your must provide IP address of the Clear Grass.');
    }

    if (!this.token) {
        throw new Error('Your must provide token of the Clear Grass.');
    }

    this.service = new Service.AirQualitySensor(this.name);

	
        this.service
            .getCharacteristic(Characteristic.AirQuality)
            .on('get', this.getAirQuality.bind(this));
	    

    this.service
        .getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

	this.pm2_5Characteristic = this.service.addCharacteristic(Characteristic.PM2_5Density);
        this.service
            .getCharacteristic(Characteristic.PM2_5Density)
            .on('get', this.getPM25.bind(this));


	this.tvocCharacteristic = this.service.addCharacteristic(Characteristic.VOCDensity);
        this.service
            .getCharacteristic(Characteristic.VOCDensity)
            .on('get', this.getTvoc.bind(this));


    this.serviceInfo = new Service.AccessoryInformation();

    this.serviceInfo
        .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
        .setCharacteristic(Characteristic.Model, 'Clear Grass')
        .setCharacteristic(Characteristic.SerialNumber, this.token.toUpperCase());

    this.services.push(this.service);
    this.services.push(this.serviceInfo);

    if (this.showTemperature) {
        this.temperatureSensorService = new Service.TemperatureSensor(this.nameTemperature);

	this.temperatureCharacteristic = this.service.addCharacteristic(Characteristic.CurrentTemperature);
        this.temperatureSensorService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getTemperature.bind(this));

        this.services.push(this.temperatureSensorService);
    }

    if (this.showHumidity) {
        this.humiditySensorService = new Service.HumiditySensor(this.nameHumidity);

    this.humidityCharacteristic = this.service.addCharacteristic(Characteristic.CurrentRelativeHumidity);
        this.humiditySensorService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getHumidity.bind(this));

        this.services.push(this.humiditySensorService);
    }

    if (this.showCo2) {
        this.carbonDioxideService = new Service.CarbonDioxideSensor(this.nameCo2);

	this.co2Characteristic = this.service.addCharacteristic(Characteristic.CarbonDioxideDetected);
        this.carbonDioxideService
            .getCharacteristic(Characteristic.CarbonDioxideDetected)
            .on('get', this.getCo2.bind(this));

	this.co2LevelCharacteristic = this.service.addCharacteristic(Characteristic.CarbonDioxideLevel);
        this.carbonDioxideService
            .getCharacteristic(Characteristic.CarbonDioxideLevel)
            .on('get', this.getCo2Level.bind(this));


        this.services.push(this.carbonDioxideService);


    }

    this.discover();
}

ClearGrassAirMonitor.prototype = { 
    discover: function() {
        var log = this.log;
        var that = this;

        miio.device({
                address: this.ip,
                token: this.token
            })
            .then(device => {
                    log.debug('Discovered Mi Clear Grass (%s) at %s ', device.miioModel, this.ip );

                if (device.miioModel == 'cgllc.airmonitor.s1') {
                    that.device = device;

                    log.debug('Model       : ' + device.miioModel);
                    log.debug('Power       : ' + device.property('power'));
                    log.debug('Mode        : ' + device.property('mode'));
                    log.debug('Temperature : ' + device.property('temperature'));
                    log.debug('Humidity    : ' + device.property('humidity'));
                    log.debug('Air Quality : ' + device.property('aqi'));
                    log.debug('co2         : ' + device.property('co2'));
                    log.debug('tvoc        : ' + device.property('tvoc'));


			        that.loadData();
                }
            })
            .catch(err => {
                log.debug('Failed to discover Clear Grass at %s', this.ip);
                console.log('Will retry after 30 seconds' + err);
                setTimeout(function() {
                    that.discover();
                }, 30000);
            });
    },
    loadData: function(){
        var log = this.log;
        var that = this;

	    that.device.call("get_prop", ["co2","pm25","tvoc","temperature","humidity"]).then(result => {
		    that.co2 = result['co2'];
		    that.humidity = result['humidity'];
		    that.aqi = result['pm25'];
		    that.tvoc = result['tvoc'] / 22.45 / 10;
		    that.temperature = result['temperature'];
		    that.pm2_5Characteristic.updateValue(that.aqi);
		    that.tvocCharacteristic.updateValue(that.tvoc);
		    that.temperatureCharacteristic.updateValue(that.temperature);
		    that.humidityCharacteristic.updateValue(that.humidity);
		    that.co2Characteristic.updateValue(that.co2);
		    that.co2LevelCharacteristic.updateValue(that.co2);

                }).catch(function(err) {
                    callback(err);
                });
	    
                setTimeout(function() {
                    that.loadData();
                }, 5000);
    },
    
    getStatusActive: function(callback) {
        if (!this.device) {
            callback(new Error('No AirQuality Sensor is discovered.'));
            return;
        }

        const state = (this.mode != 'idle') ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;

        this.log.debug('getStatusActive: Mode -> %s', this.mode);
        this.log.debug('getStatusActive: State -> %s', state);
        callback(null, state);
    },

    getAirQuality: function(callback) {
        if (!this.device) {
            callback(new Error('No AirQuality Sensor is discovered.'));
            return;
        }

        this.log.debug('getAirQuality: %s', this.aqi);

        for (var item of this.aqiLevels) {
            if (this.aqi >= item[0]) {
                callback(null, item[1]);
                return;
            }
        }
    },

    getPM25: function(callback) {
        if (!this.device) {
            callback(new Error('No AirQuality Sensor is discovered.'));
            return;
        }

        this.log.debug('getPM25: %s', this.aqi);

        callback(null, this.aqi);
    }
    ,getTvoc: function(callback) {
        if (!this.device) {
            callback(new Error('No AirQuality Sensor is discovered.'));
            return;
        }

        this.log.debug('getTvoc: %s', this.tvoc);

        callback(null, this.tvoc);
    },

    getCo2: async function(callback) {
        if (!this.device) {
            callback(new Error('No AirQuality Sensor is discovered.'));
            return;
        }

        this.log.debug('getCo2: %s', this.co2);
	if(this.co2 < 1000){
	        callback(null, Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL);
	}
	else{
	        callback(null, Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL);
	}
    },


    getCo2Level: async function(callback) {
        if (!this.device) {
            callback(new Error('No AirQuality Sensor is discovered.'));
            return;
        }

        this.log.debug('getCo2: %s', this.co2);
        callback(null, this.co2);
    },



    getTemperature: function(callback) {
        if (!this.device) {
            callback(new Error('No AirQuality Sensor is discovered.'));
            return;
        }

        this.log.debug('getTemperature: %s', this.temperature);

        callback(null, this.temperature);
    },

    getHumidity: function(callback) {
        if (!this.device) {
            callback(new Error('No AirQuality Sensor is discovered.'));
            return;
        }

        this.log.debug('getHumidity: %s', this.humidity);

        callback(null, this.humidity);
    },

    identify: function(callback) {
        callback();
    }

    ,getServices: function() {
        return this.services;
    }
};
