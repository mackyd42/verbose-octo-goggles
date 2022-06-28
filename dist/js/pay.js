var g_curUrl = new URL(window.location.href);
var g_query = g_curUrl.searchParams;
var g_stripe = null;

function InitPayPalButton() {
  var ppButton = paypal.Buttons({
    style: {
      shape: 'pill',
      color: 'gold',
      layout: 'vertical',
      label: 'buynow'
    },

    createOrder: function(data, actions) {
        var currentTotal = GetCurrentTotal(true);
      return actions.order.create({
        purchase_units: [{
            "description":currentTotal.total.label,
            "amount":{
                "currency_code":"USD",
                "value":currentTotal.total.amount / 100
            }
        }],
        application_context: {
            shipping_preference: "NO_SHIPPING",
            return_url: "htt" + "ps:/" + "/fi" + "te.buteasier.com/champion.html",
            cancel_url: "htt" + "ps:/" + "/fi" + "te.buteasier.com/cancelled.html",
            user_action: "PAY_NOW"
        }
      });
    },

    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
          goodPayment(details.payer.name.given_name, details.payer.email_address);
      });
    },

    onError: function(err) {
      failedPayment(err);
    },
    
    onClick: function(data, actions) {
        var currentTotal = GetCurrentTotal(true);
        if(currentTotal.total.amount == 0)
        {
            NoItemsPaypalMessage();
            return actions.reject();
        }
        return actions.resolve();
    }
  });
  ppButton.render('#paypal-button-container');
}

function InitPayPalButtonOrRedirect()
{
    InitPayPalButton();
    /*var paypalRow = GetElement('ppRow');
    paypalRow.style.display = 'none';
    paypalRow = GetElement('ppRowNonSub');
    paypalRow.style.display = 'none';*/
}

function goodPayment(name, email)
{
    var container = GetElement('resultMessage');
    container.innerHTML = 
        '<p class="biggerText goodResult">Success</p><p>Thank you ' + name + '</p><p>If you don\'t have an account you will receive an email to create one.</p>' +
        '<p><a href="FTV.zip">Download the app here</a> if you haven\'t already</p>' + 
        '<p>You may now close this tab/window</p>';
    ChangeElementDisplay('block', 'paymentResult');
    container.scrollIntoView();
}

function failedPayment(err)
{
    var container = GetElement('resultMessage');
    var msgHTML = '<p class="biggerText badResult">Failed</p><p>An error occured making the payment:</p>';
    if(err)
    {
        msgHTML += '<blockquote>' + err + '</blockquote>';
    }
    msgHTML += '<p>You have not been charged. Please refresh the page to try again, or choose a different payment option.</p>';
    container.innerHTML = msgHTML;
    ChangeElementDisplay('block', 'paymentResult');
    container.scrollIntoView();
}

function NoItemsPaypalMessage()
{
    var container = GetElement('resultMessage');
    container.innerHTML = '<p>You didn\'t select anything to buy. Please select an upgrade and try again.</p>';
    ChangeElementDisplay('block', 'paymentResult');
}

function RevealPayment()
{
    var headerDiv = GetElement('entryHeader');
    var revealDiv = GetElement('paymentMethods');
    revealDiv.style.display = 'block';
    headerDiv.style.display = 'none';
}

function PIReqStateChange(xhr, ev)
{
    if(xhr.readyState == 4)
    {
        var status = xhr.status;
        var retText = xhr.responseText;
        if ((status === 0) || (status == 200)) {
            confirmPayment(ev, retText);
        }
        else
        {
            failedPayment(retText);
            ev.complete('fail');
        }
    }
}

function CheckoutStateChange(xhr, ev)
{
    if(xhr.readyState == 4)
    {
        var status = xhr.status;
        var retText = xhr.responseText;
        if ((status === 0) || (status == 200)) {
            var opts = {sessionId:retText};
            try
            {
                g_stripe.redirectToCheckout(opts).then(
                    function(result)
                    {
                        if(result.error)
                        {
                            failedPayment(result.error.message);
                            EnableCheckoutLinks();
                        }
                    }
                );
            }
            catch(e)
            {
                if(e.message)
                {
                    failedPayment(e.message);
                    EnableCheckoutLinks();
                }
            }
        }
        else
        {
            failedPayment(retText);
            EnableCheckoutLinks();
        }
    }
}

function MakePIUrl(name, email, action)
{
    var curQuery = new URLSearchParams(g_tagString.toString());
    if(email)
    {
        curQuery.append('email', email);
    }
    else if(g_query.has('email'))
    {
        curQuery.append('email', g_query.get('email'));
    }
    if(name)
    {
        curQuery.append('name', name);
    }
    curQuery.append('action', action);
    if(!IsSubSelected())
    {
        curQuery.append('months', GetNumberOfMonths(null));
    }
    var api = '/FTV/payment';
    if(g_stripeKey.includes('_test_'))
    {
        api = '/dbg' + api;
    }
    var url = new URL('https://portal.buteasier.com' + api);
    url.search = curQuery.toString();
    return url;
}

function IsSubSelected()
{
    var subButton = GetElement('subButton');
    return parseInt(subButton.getAttribute('data-checked'));
}

function HasSubUpgrade()
{
    return g_recurring > 0;
}

function DoNoChoiceHandling()
{
    GetElement('pluginChoice').scrollIntoView();
    alert('You didn\'t select anything to buy!');
}

function StartCheckout()
{
    if(g_amount == 0)
    {
        DoNoChoiceHandling();
        return;
    }
    DisableCheckoutLinks();
    var msgLoc = GetElement('resultMessage');
    msgLoc.scrollIntoView();
    msgLoc.innerText = "Redirecting... Please wait";
    var url = MakePIUrl(null, null, IsSubSelected() ? 'c' : 'nsc');
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onreadystatechange = function() {CheckoutStateChange(xhr);};
    xhr.send();
}

function ModifyCheckoutLinks(on)
{
    var anchorList = document.getElementsByTagName('a');
    var numAnchors = anchorList.length;
    var pointerEvents;
    var cell = GetElement('checkoutCell');
    var clickClass = 'clickableCell';
    var classes = cell.className;
    if(on)
    {
        pointerEvents = '';
        classes += ' ' + clickClass;
    }
    else
    {
        pointerEvents = 'none';
        classes = classes.replace(clickClass, '');
    }
    for(var i = 0; i < numAnchors; ++i)
    {
        var thisA = anchorList[i];
        var curUrl = thisA.getAttribute('data-checkout');
        if(curUrl == "1")
        {
            thisA.style.pointerEvents = pointerEvents;
        }
    }
    cell.className = classes;
}

function DisableCheckoutLinks()
{
    ModifyCheckoutLinks(false);
}

function EnableCheckoutLinks()
{
    ModifyCheckoutLinks(true);
}

function browserPaymentCommon(ev, code)
{
    // a@b.co = 6
    if((ev.payerEmail.length < 6) || (ev.payerName.length <= 2))
    {
        failedPayment('Invalid name or email address');
        if(ev)
        {
            ev.complete('failure');
        }
        return;
    }
    var url = MakePIUrl(ev.payerName, ev.payerEmail, code);
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onreadystatechange = function() {PIReqStateChange(xhr, ev);};
    xhr.send();
}

function paymentStart(ev)
{
    browserPaymentCommon(ev, IsSubSelected() ? 'p' : 'nsp');
}

function confirmPayment(ev, clientSecret)
{
    if((clientSecret == null) || (clientSecret == ''))
    {
        goodPayment(ev.payerName, ev.payerEmail);
        ev.complete('success');
        return;
    }
    var data = {
        payment_method: ev.paymentMethod.id
    };
  g_stripe.confirmCardPayment(
    clientSecret,
    data,
    {handleActions: false}
  ).then(function(confirmResult) {
    if (confirmResult.error) {
      ev.complete('fail');
    } else {
      ev.complete('success');
      if (confirmResult.paymentIntent.status === "requires_action") {
        // Let Stripe.js handle the rest of the payment flow.
        g_stripe.confirmCardPayment(clientSecret).then(function(result) {
          if (result.error) {
              failedPayment(result.error.message);
          } else {
              goodPayment(ev.payerName, ev.payerEmail);
          }
        });
      }
      else
      {
          goodPayment(ev.payerName, ev.payerEmail);
      }
    }
  });
}

function GetCurrentTotal(needSmall)
{
    var newData = null;
    var currentDesc = GetNewOrderDesc();
    if(!IsSubSelected())
    {
        var newAmount = GetNonSubAmount();
        var numMonths = GetNumberOfMonths(null);
        var monthText = HasSubUpgrade() ? ' (' + numMonths + ' months)' : '';
        newData = {
            currency: 'usd',
            total: {
                label: currentDesc + monthText,
                amount: newAmount
            }
        };
    }
    else
    {
        newData = {
          currency: 'usd',
          total: {
            label: currentDesc,
            amount: g_amount
          }
        };
    }
    if(!needSmall)
    {
        newData.country = 'GB';
        newData.requestPayerName = true;
        newData.requestPayerEmail = true;
    }
    return newData;
}

function UpdatePayRequest(event, payRequest)
{
    var currentTotal = GetCurrentTotal(true);
    if(currentTotal.total.amount == 0)
    {
        event.preventDefault();
        DoNoChoiceHandling();
        return false;
    }
    payRequest.update(currentTotal);
}

function SetupStripePayment()
{
    g_stripe = Stripe(g_stripeKey);
    var startTotal = GetCurrentTotal(false);
    var payRequest = g_stripe.paymentRequest(startTotal);
    var elements = g_stripe.elements();
    var prButton = elements.create('paymentRequestButton', {paymentRequest: payRequest});
    payRequest.canMakePayment().then(function(result)
    {
        if(result)
        {
            prButton.on('click', function(event) {UpdatePayRequest(event, payRequest);});
            payRequest.on('paymentmethod', paymentStart);
            prButton.mount('#stripe-buttons');
        }
        else
        {
            var buttonDiv = GetElement('stripe-buttons');
            var textDiv = GetElement('no-stripe-buttons');
            buttonDiv.style.display = 'none';
            textDiv.style.display = 'block';
        }
    });
}

function UpdatePriceText(newAmount)
{
    var textSpan = GetElement('priceText');
    textSpan.innerText = (newAmount / 100).toFixed(2);
}

function WritePriceText(newAmount)
{
    UpdatePriceText(newAmount);
    if(HasSubUpgrade())
    {
        var recurSpan = GetElement('monthlyPrice');
        var recurTextSpan = GetElement('recurPriceText');
        recurTextSpan.innerText = (g_recurring / 100).toFixed(2);
        recurSpan.style.display = 'block';
    }
}

function DoSubConversion()
{
    DoCurrencyConversion('newCurSelect', 'conversionResult', g_amount / 100, 'GBP');
}

function GetNumberOfMonths(monthSelector)
{
    if(monthSelector == null)
    {
        monthSelector = GetElement('monthCountNumber');
    }
    return parseInt(monthSelector.value);
}

function GetNonSubAmount(monthSelector)
{
    var numMonths = GetNumberOfMonths(monthSelector);
    var singleAmount = (g_amount - g_recurring);
    return (g_recurring * numMonths) + singleAmount;
}

function UpdateNonSubPrice(monthSelector)
{
    var amount = GetNonSubAmount(monthSelector);
    UpdatePriceText(amount);
}

function SubTypeChange(changed)
{
    var isSub = parseInt(changed.getAttribute('data-subvalue'));
    var buttons = document.getElementsByClassName('payTypeButton');
    var numButtons = buttons.length;
    var selectedClass = ' payTypeSelected';
    if(changed.getAttribute('data-checked') != '1')
    {
        for(var i = 0; i < numButtons; ++i)
        {
            var thisButton = buttons[i];
            if(thisButton == changed)
            {
                thisButton.setAttribute('data-checked', '1');
                thisButton.className += selectedClass;
            }
            else
            {
                thisButton.setAttribute('data-checked', '0');
                thisButton.className = thisButton.className.replace(selectedClass, '');
            }
        }
    }
    var header = GetElement('payTypeText');
    var stemText = header.getAttribute('data-stem');
    var type = changed.getAttribute('data-type');
    header.innerText = stemText.replace('%1', type);
    if(isSub)
    {
        ChangeElementDisplay('none', 'ppRow', 'nonSubOptions', 'ppMsg');
        WritePriceText(g_amount); // shows monthlyPrice if required
    }
    else
    {
        if(HasSubUpgrade())
        {
            ChangeElementDisplay('block', 'nonSubOptions');
        }
        ChangeElementDisplay('table-row', 'ppRow', 'ppMsg');
        ChangeElementDisplay('none', 'monthlyPrice');
        UpdateNonSubPrice(GetElement('monthCountNumber'));
    }
}

function CheckOrigin()
{
    var origin = g_query.get('from');
    if(origin && (origin == 'l' || origin == 's'))
    {
        RevealPayment();
    }
}

function UpdatePayTypeBoxes()
{
    if(g_recurring == 0)
    {
        ChangeElementDisplay('none', 'payType', 'nonSubOptions');
        SubTypeChange(GetElement('nonSubButton'));
    }
    else
    {
        SubTypeChange(GetElement('subButton'));
        /*var payTypeButtons = document.getElementsByClassName('payTypeButton');
        var numButtons = payTypeButtons.length;
        for(var i = 0; i < numButtons; ++i)
        {
            var button = payTypeButtons[i];
            if(button.getAttribute('data-checked') == '1')
            {
                SubTypeChange(button);
                break;
            }
        }*/
        ChangeElementDisplay('block', 'payType');
    }
}

function GetLocationStateChange(xhr)
{
    if(xhr.readyState == 4)
    {
        var respText = xhr.responseText;
        if(respText !== '')
        {
            var wweTags = ['wwe', 'lmaius'];
            var isUnblock = IsUnblockerCountry(respText, null);
            var toRemove = isUnblock ? 0 : 1;
            var tagToRemove = wweTags[toRemove];
            var checkbox = GetElement(tagToRemove);
            var parent = checkbox.parentNode;
            if(checkbox.checked)
            {
                var otherCheckbox = GetElement(wweTags[toRemove ^ 1]);
                otherCheckbox.checked = true;
                UpdatePrices(otherCheckbox);
            }
            checkbox.checked = false;
            UpdatePrices(checkbox);
            if((!isUnblock) && g_query.has('lmaius'))
            {
                ChangeElementDisplay('block', 'wwenonUSWarning');
                var brTag = parent.nextElementSibling;
                parent.remove();
                brTag.remove();
                delete g_buyableItems[tagToRemove];
            }
            else if(isUnblock && g_query.has('wwe'))
            {
                ChangeElementDisplay('block', 'wweUSWarning');
            }
        }
    }
}

function DoLocationRequest()
{
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {GetLocationStateChange(xhr);};
    xhr.open("GET", 'https://www.cloudflare.com/cdn-cgi/trace');
    xhr.send();
}

function InitPage()
{
    var isFree = g_query.has('free');
    g_query.delete('free');
    var selectors = ['freePart', 'payPart'];
    var hideSelector = selectors[isFree + 0];
    var elements = document.getElementsByClassName(hideSelector);
    var numElems = elements.length;
    for(var i = 0; i < numElems; ++i)
    {
        // the list is live, so as we remove the selector
        // it removes the item from the list we're iterating
        var classList = elements[i].classList;
        classList.add('hidden');
    }
    if(!isFree)
    {
        var payButton = GetElement('mainPayButton');
        payButton.onmouseover = function() {changeImages(1);};
        payButton.onmouseout = function() {changeImages(0);};
    }
}

function InitUI()
{
    if(g_preLoc === '')
    {
        DoLocationRequest();
    }
    CreatePluginBoxes();
    UpdatePayTypeBoxes();
    InitPayPalButtonOrRedirect();
}

function GetCheckedItems()
{
    var buyForm = GetElement('pluginChoice');
    var checkedDetails = GetCheckedChildren(buyForm);
    var checkedItems = checkedDetails.checkedItems;
    var numChecked = checkedItems.length;
    var boughtString = '';
    var subAmount = 0;
    var singleAmount = 0;
    var numMonths = GetNumberOfMonths(null);
    for(var i = 0; i < numChecked; ++i)
    {
        var checkedItem = checkedItems[i];
        var item = g_buyableItems[checkedItem];
        if(item.isSub)
        {
            subAmount += item.price;
        }
        else
        {
            singleAmount += item.price;
        }
        boughtString += item.desc + ', ';
    }
    return {
        subAmount:subAmount,
        months:numMonths,
        singleAmount:singleAmount,
        totalAmount:singleAmount + (subAmount * numMonths),
        boughtString:boughtString.substring(0, boughtString.length - 2),
        items:checkedItems
    };
}

function GetNewOrderDesc()
{
    var firstBit = 'F' + 'TV' + 'D' + 'L ';
    var createdString = '';
    for(var tags of g_tagString)
    {
        var tag = tags[0];
        var plugObj = g_buyableItems[tag];
        createdString += plugObj.name + ', ';
    }
    var createdLen = createdString.length;
    if(createdLen > 0)
    {
        createdString = createdString.substring(0, createdLen - 2);
    }
    return firstBit + ((createdLen == 0) ? '' : createdString);
}

function UpdatePrices(changedBox)
{
    var tag = changedBox.id;
    var plugObj = g_buyableItems[tag];
    var isSub = plugObj.isSub;
    var price = plugObj.price;
    var hadRecurringBefore = HasSubUpgrade();
    if(changedBox.checked)
    {
        g_tagString.append(tag, 'on');
        if(isSub)
        {
            g_recurring += price;
        }
        g_amount += price;
        
    }
    else
    {
        g_tagString.delete(tag);
        if(isSub)
        {
            g_recurring -= price;
        }
        g_amount -= price;
    }
    if(IsSubSelected())
    {
        WritePriceText(g_amount)
    }
    else
    {
        UpdateNonSubPrice(null);
    }
    var hadRecurringAfter = HasSubUpgrade();
    if(hadRecurringBefore != hadRecurringAfter)
    {
        UpdatePayTypeBoxes();
    }
}

function InitialisePrices()
{
    var buyState = GetCheckedItems(GetElement('pluginForm'));
    g_recurring = buyState.subAmount;
    g_amount = buyState.subAmount + buyState.singleAmount;
    var checked = buyState.items;
    var numChecked = checked.length;
    for(var i = 0; i < numChecked; ++i)
    {
        g_tagString.append(checked[i], 'on');
    }
}

function IsUnblockerCountry(cloudFlare, text)
{
    var res = -1;
    if(cloudFlare)
    {
        res = cloudFlare.search(/loc=(US|CA|IN)/);
    }
    else
    {
        res = text.search(/(US|CA|IN)/);
    }
    return res != -1;
}

function CreatePluginBoxes()
{
    var plugObjs = g_buyableItems;
    if(g_preLoc !== '')
    {
        if(IsUnblockerCountry(null, g_preLoc))
        {
            if(g_query.has('wwe'))
            {
                ChangeElementDisplay('block', 'wweUSWarning');
                g_query.delete('wwe');
                g_query.append('lmaius', 'on');
            }
        }
        else
        {
            delete g_buyableItems['lmaius'];
            if(g_query.has('lmaius'))
            {
                ChangeElementDisplay('block', 'wwenonUSWarning');
                g_query.append('wwe', 'on');
            }
            g_query.delete('lmaius');
        }
    }
    var tags = Object.keys(plugObjs);
    var numTags = tags.length;
    var subTree = GetElement('subCheckboxes');
    var nonsubTree = GetElement('nonsubCheckboxes');
    for(var i = 0; i < numTags; ++i)
    {
        var tag = tags[i];
        if(tag == 'lmaiup') continue;
        var plugObj = plugObjs[tag];
        var isSub = plugObj.isSub;
        var spanbox = document.createElement('span');
        spanbox.className = 'noWrapSpan';
        var checkbox = document.createElement('input');
        var label = document.createElement('label');
        var pItem = document.createElement('br');
        checkbox.className = 'plugCheckbox';
        checkbox.type = 'checkbox';
        checkbox.name = checkbox.id = tag;
        checkbox.value = 'on';
        if(g_query.has(tag))
        {
            checkbox.checked = true;
        }
        checkbox.onclick = function() {UpdatePrices(this);};
        label.htmlFor = tag;
        var labelText = sprintf('%1 - £%2%3', plugObj.desc, plugObj.price / 100, plugObj.isSub ? ' per month' : '');
        label.innerText = labelText;
        var container = isSub ? subTree : nonsubTree;
        spanbox.appendChild(checkbox);
        spanbox.appendChild(label);
        container.appendChild(spanbox);
        container.appendChild(pItem);
    }
    InitialisePrices();
}