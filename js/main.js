
//Модель погоды строиться из приходящего json
class WeatherModel {
   constructor(jsonObject) {
     this.city = jsonObject["name"];
     this.temperature = parseInt(jsonObject["main"]["temp"]);
     this.humidity = jsonObject["main"]["humidity"];
     this.wind = jsonObject["wind"]["speed"];
     this.country = jsonObject["sys"]["country"];
     this.id = jsonObject["id"];
     this.description = jsonObject["weather"][0]["description"];
     this.iconName = this.backgroundFileName(jsonObject["weather"][0]["icon"]);
     this.lat = jsonObject["coord"]["lat"];
     this.lon = jsonObject["coord"]["lon"];
   }

   backgroundFileName(sourceFileName) {
     let iconName = "";
     let timeOfDay = "";
     if (sourceFileName.indexOf('d') != -1) {
       timeOfDay = 'day';
     } else {
       timeOfDay = 'night';
     }

     if(sourceFileName == '01d' || sourceFileName == '01n') {
       iconName = 'clear';
     }

     if(sourceFileName == '02d' || sourceFileName == '02n' || sourceFileName == '03d' || sourceFileName == '03n' || sourceFileName == '04d' || sourceFileName == '04n') {
       iconName = 'clouds';
     }

     if(sourceFileName == '09d' || sourceFileName == '09n' || sourceFileName == '10d' || sourceFileName == '10n') {
       iconName = 'rain';
     }

     if(sourceFileName == '11d' || sourceFileName == '11n') {
       iconName = 'storm';
     }

     if(sourceFileName == '13d' || sourceFileName == '13n') {
       iconName = 'snow';
     }

     if(sourceFileName == '50d' || sourceFileName == '50n') {
       iconName = 'mist';
     }
     return "images/"+timeOfDay+"_"+iconName+".jpg";
   }
}


class WeatherApiClient {
    constructor(appId) {
        //персональный ключ
        this.appId = appId
        //параметр системы координат (цельсии и километы) - метрическая
        this.units = "metric"
        //Базовый URL API
        this.apiURL = "https://api.openweathermap.org/data/2.5/weather"
    }

    //базовый метод запроса погоды
    weatherRequestWithQuery(params, onSuccess, onFailure) {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", this.apiURL+params , true);
        xhr.onload = function (e) {
          if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                let response = JSON.parse(xhr.responseText);
                let model = new WeatherModel(response);
                // в ответ приходит готовая модель погоды
                onSuccess(model);
              } else {
                // если ошибка - отправляем текст
                onFailure(xhr.statusText);
              }
           }
       }
       xhr.onerror = function (e) {
          onFailure(xhr.statusText);
       };
       xhr.send(null);
    }
    // запрос по координатам
    requestForCoordinates(lat, lon, onSuccess, onFailure) {
      let params = "?lat="+lat+"&lon="+lon+"&APPID="+this.appId+"&units="+this.units;
      this.weatherRequestWithQuery(params, onSuccess, onFailure);
    }
    //запрос поиска города по имени
    requestForCityNamed(name, onSuccess, onFailure) {
      let params = "?q="+encodeURIComponent(name)+"&APPID="+this.appId+"&units="+this.units;
      this.weatherRequestWithQuery(params, onSuccess, onFailure)
    }
    //запрос по id города
    requestForCityWithId(id, onSuccess, onFailure) {
      let params = "?id="+id+"&APPID="+this.appId+"&units="+this.units;
      this.weatherRequestWithQuery(params, onSuccess, onFailure)
    }
};

class ViewDrawer {
    constructor(view, weather, container = view) {
        this.view = view;
        this.container = container;
        if (weather) {
          this.updateWithWeather(weather);
        }
    }

    firstElementByClassName(className) {
      return this.view.getElementsByClassName(className)[0];
    }

    updateWithWeather(weather) {
      if (!weather) {
        return;
      }
      this.firstElementByClassName('temperature').innerHTML = weather.temperature+' °C';
      this.container.style.backgroundImage = "linear-gradient(0deg,rgba(0,0,0,0.3),rgba(0,0,0,0.3)),url("+weather.iconName+")";
    }

}


class CellCityDrawer extends ViewDrawer {
  constructor(weather, onDeleteCity, onChangeSelectedCity) {
    let list = document.getElementById('mainList');
    let view = document.getElementsByClassName('templateCell')[0].cloneNode(true);
    view.classList.remove("templateCell");
    list.appendChild(view);
    super(view, weather, view.getElementsByClassName("informAboutCity")[0]);
    this.list = list;
    let that = this;
    this.firstElementByClassName('buttonDelete').onclick = function (event) {
        if (onDeleteCity) {
          onDeleteCity();
        }
        that.deleteCell();
    };
    this.firstElementByClassName('checker').onclick  = function (event) {
        if (onChangeSelectedCity) {
          onChangeSelectedCity();
        }
    };

  }
  deleteCell() {
    this.list.removeChild(this.view);
  }

  setSelected(isSelected) {
    this.firstElementByClassName('checker').checked = isSelected;
  }

  updateWithWeather(weather) {
    super.updateWithWeather(weather);
    this.firstElementByClassName('description').innerHTML = weather.description;
    this.firstElementByClassName('wind').innerHTML = "wind: "+weather.wind + " kmh";
    this.firstElementByClassName('humidity').innerHTML =  "humidity: "+weather.humidity + " %";
    this.firstElementByClassName('name').innerHTML = weather.city+',  '+weather.country;
  }
}

class WidgetDrawer extends ViewDrawer {
  constructor() {
    let widget = document.getElementById('widget');
    super(widget, null);
  }

  updateWithWeather(weather) {
    super.updateWithWeather(weather);
    this.view.style.display = !weather ? "none" : null;
    if (!weather) {
      return;
    }
    this.firstElementByClassName('description').innerHTML = weather.city+' '+weather.description;
  }
}

class CitiesController {
    constructor(appId) {
      this.apiClinet = new WeatherApiClient(appId);
      this.widgetUpdater = new WidgetDrawer();
      this.weathers = {};
      this.cities = [];
      this.loadFromLocalStorage();
      if (!this.cities.length) {
        //если список городов из локал стореджа пуст запрашивае локацию
        this.addCityFromUserLocation();
        this.updateWidgetWithWeather(null);
      }
    }

    loadFromLocalStorage() {
      let itemsString = window.localStorage.getItem("cities");
      this.selectedCity = window.localStorage.getItem("selectedCity");
      if (!this.selectedCity) {
        this.selectedCity = "";
      }
      if (itemsString) {
          this.cities = JSON.parse(itemsString);
          this.cities.forEach(function (id) {
            this.addCityWithId(id);
          }.bind(this));
      }
    }

    saveCitiesToLocalStorage() {
      //провреяем не вышло тли так что у нас нет выбранных городов
      this.checkAndSelectIfNoSelected();
      window.localStorage.setItem("cities", JSON.stringify(this.cities));
   }

    showError(error) {
      alert(error);
    }

    getLocation(onLocationGet, onFailure) {
       let options = {
         enableHighAccuracy: true,
         timeout: 10000,
         maximumAge: 0
       };
       function onSuccess(position) {
           console.log("position = ", position);
           onLocationGet(position.coords);
       }
       function onFail(err) {
           onFailure(err.message);
       }
       if (navigator.geolocation) {
         navigator.geolocation.getCurrentPosition(onSuccess, onFail, options);
       } else {
         onFailure("Geolocation is not supported by this browser.");
       }
   }

    addCityFromUserLocation() {
      this.getLocation(function(coords) {
        this.apiClinet.requestForCoordinates(coords.latitude, coords.longitude, this.addNewCity.bind(this) ,this.showError.bind(this))
      }.bind(this), function (error) {
        console.log(error);
      }.bind(this));
    }

    addCityWithName(name) {
      this.apiClinet.requestForCityNamed(name, this.addNewCity.bind(this) ,this.showError.bind(this));
    }

    newCellUpdater(weather) {
      let that = this;
      let onDeleteCity = function() {
        that.removeCity(weather);
      }
      let onSelectCity = function() {
        that.selectMainCity(that.weathers[weather.id]);
      }
      return new CellCityDrawer(weather, onDeleteCity, onSelectCity);
    }

    isCityExist(id) {
        return this.cities.filter(function (city) { return city == id}).length >0
    }

    addNewCity(weather) {
      if (this.isCityExist(weather.id)) {
        this.showError("City "+weather.city+" already exist in list.");
        return;
      }
      let updater = this.newCellUpdater(weather);
      this.setupWeatherCell(weather, updater);
      this.cities.push(weather.id);
      this.saveCitiesToLocalStorage();
    }

    addCityWithId(id) {
      let updater = this.newCellUpdater({id : id});
      let onSuccess = function (weather) {
        this.setupWeatherCell(weather, updater);
      }.bind(this);
      this.apiClinet.requestForCityWithId(id, onSuccess ,this.showError.bind(this));
    }

    removeCity(weather) {
      this.cities = this.cities.filter(function (city) { return city != weather.id});
      this.saveCitiesToLocalStorage();
    }

    setupWeatherCell(weather, updater) {
      this.weathers[weather.id] = weather;
      let isSelected = weather.id==this.selectedCity;
      updater.updateWithWeather(weather);
      updater.setSelected(isSelected);
      if (isSelected) {
        this.updateWidgetWithWeather(weather);
      }
    }

    updateWidgetWithWeather(weather) {
       this.widgetUpdater.updateWithWeather(weather);
    }

    selectMainCity(weather) {
      this.selectedCity = weather.id;
      this.updateWidgetWithWeather(weather);
      window.localStorage.setItem("selectedCity", weather.id);
    }

    checkAndSelectIfNoSelected() {
      if (this.isCityExist(this.selectedCity)) {
        return
      }
      let city = this.cities[0];
      if (city) {
        this.selectedCity = city;
        this.selectMainCity(this.weathers[city]);
      } else {
        this.widgetUpdater.updateWithWeather(null);
      }
    }
  }

  class InputController {
      constructor(onCityAdd) {
        let addButton = document.getElementById("addCityButton");
        let input = document.getElementById("addCityInput");
        addButton.onclick = function (event) {
            if (input.value.length > 2) {
                console.log("on button add");
                onCityAdd(input.value);
                input.value = "";
            }
        }
      }
  }

  document.addEventListener("DOMContentLoaded", function(event) {
    let appId;
    if (!appId) {
        alert("Insert your api key to get work!");
        return;
    }
    let controller = new CitiesController(appId);
    let input = new InputController(controller.addCityWithName.bind(controller));
  });
