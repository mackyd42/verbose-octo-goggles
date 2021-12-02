function sprintf(str) {
    var args = arguments;
    return str.replace(/%(\d)/g, function (x, num) {
        return args[num];
    });
}

function GetCheckedChildren(parentItem)
{
    var subPlugins = parentItem.getElementsByTagName('input');
    var numInputs = subPlugins.length;
    var numPlugins = 0;
    var checked = [];
    
    for(var i = 0; i < numInputs; ++i)
    {
        var thisPlugin = subPlugins[i];
        if(thisPlugin.type == 'checkbox')
        {
            ++numPlugins;
        }
        if(thisPlugin.checked)
        {
            checked.push(thisPlugin.id);
        }
    }
    return {howMany: numPlugins, checkedItems: checked};
}

function GetElement(id)
{
    return document.getElementById(id);
}

function ChangeElementDisplay(type)
{
    var elements = arguments;
    var numElements = elements.length;
    for(var i = 1; i < numElements; ++i)
    {
        var domElem = GetElement(elements[i]);
        if(domElem)
        {
            domElem.style.display = type;
        }
        else console.log('ChangeElementDisplay: ' + elements[i] + ' doesn\'t exist!');
    }
}

function CurReqChange(xhr, resultBox)
{
    if(xhr.readyState == 4)
    {
        var status = xhr.status;
        var retText = xhr.responseText;
        var resultItem = GetElement(resultBox);
        if (status == 200) {
            var obj = JSON.parse(retText);
            resultItem.innerHTML = obj.result;
        }
        else
        {
            resultItem.innerHTML = '<p>Currency conversion is currently unavailable</p>';
        }
        resultItem.style.display = 'block';
    }
}

function DoCurrencyConversion(selBoxId, resultBox, amount, toCur)
{
    var selBox = GetElement(selBoxId);
    var index = selBox.selectedIndex;
    if(index == 0) return;
    var toCurUpper = toCur.toUpperCase();
    var fromCur = selBox.options[index].value;
    if(fromCur == toCurUpper) return;
    var newUrl = new URL("https://www.paypal.com/smarthelp/currency-conversion?fromCountry=US&toCountry=GB&fromPaymentCurrency=USD&toTransCurrency=GBP&tType=FX_ON_SENDER&transAmount=8.98&component=smarthelpnodeweb");
    var params = newUrl.searchParams;
    params.set('fromPaymentCurrency', fromCur);
    params.set('transAmount', amount);
    params.set('toTransCurrency', toCurUpper);
    newUrl.search = params.toString();
    var xhr = new XMLHttpRequest();
    xhr.open("GET", newUrl.toString());
    xhr.onreadystatechange = function() {CurReqChange(xhr, resultBox);};
    xhr.send();
}