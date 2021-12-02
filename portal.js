var g_activeSubId = '';
var g_availablePurchaseItems = null;
var g_customerData = null;
var g_currency = null;
var g_ppInitialised = false;
var g_ppLoaded = false;
// 1 = shortcode (lmaius etc)
// 2 - long name (WWE Unblocker etc)
// 3 - price string (4.99 not 499)
// 4 - frequency string
var g_newSubRowTemplate = "<td><table class=\"newSubTableOption\"><tr><td rowspan=\"2\"><input type=\"checkbox\" class=\"checkbox\" name=\"%1\" value=\"on\" id=\"%1\" onclick=\"EnableDisableBuyButton();\"/></td><th><label for=\"%1\">%2</label></th></tr><tr><td class=\"newSubPrice\"><span class=\"currencyCharacter\"></span>%3%4</td></tr></table></td>";
// 1 - sub status
// 2 - sub item table
// 3 - start time
// 4 - Next payment time
// 5 - Button row
var g_subItemTemplate = "<tr class=\"subItemTableRow\"><td><table class=\"subItemTable sub%1\"><tr><td class=\"subItemName\" colspan=\"2\"><h2>Subscription Upgrades</h2></td></tr><tr><td class=\"subContents\" colspan=\"2\">%2</td></tr><tr><th>Started</th><th>Next Update</th></tr><tr><td class=\"subStart\">%3</td><td class=\"nextPayment\">%4</td></tr>%5</table></td></tr>";
// 1 - sub status
// 2 - sub id
var g_subCancelButtonTemplate = "<input class=\"actionButton\" type=\"button\" onclick=\"ManageSub(this, 'c', '%1', 'manageStatusMsg');\" value=\"Cancel\" />";
var g_subUncancelButtonTemplate = "<input class=\"actionButton\" type=\"button\" onclick=\"ManageSub(this, 'u', '%1', 'manageStatusMsg');\" value=\"Stop Cancellation\" />";
var g_subPastDueButtonTemplate = "<input class=\"actionButton\" type=\"button\" onclick=\"ManageSub(this, 'pi', '%1', 'manageStatusMsg');\" value=\"Pay Invoice\" />";
// 1 - item tag
// 2 - sub id
// 3 - item desc
var g_subContentItemTemplate = "<tr><td class=\"contentItem\" colspan=\"2\"><input class=\"initiallyHidden checkbox\" type=\"checkbox\" id=\"%1\" value=\"off\" onclick=\"EnableDisableRemoveButton('%2')\" /><label for=\"%1\">%3</label></td></tr>";
// 1 - sub id
var g_subRemovePluginButtonTemplate = "<td class=\"removeActionButton\"><input class=\"actionButton\" type=\"button\" value=\"Remove Selected Plugin(s)\" id=\"remove_%1\" onclick=\"RemoveSubItems(this, '%1')\" disabled></td>";
var g_monthsSelect = '<select name="monthCount" id="monthCountNumber" onchange="UpdateNonSubPrice(this);" class="monthSelect"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select>';
function UpdateCustomerDets(cust)
{
    var detsDom = GetElement('customerDets');
    var html = "<p>";
    if((cust.name !== null) && (cust.name !== ''))
    {
        html += cust.name + " - ";
    }
    html += cust.email;
    html += '<br/>Account Balance - <span class="currencyCharacter"></span>';
    html += (Math.abs(cust.balance) / 100).toFixed(2);
    html += '</p>';
    detsDom.innerHTML = html;
    g_customerData = cust;
}

function GetSubContent(sub, allSubs)
{
    var items = sub.items.data;
    var numItems = items.length;
    var subInfo = {price: 0, tags: [], contentList: ''};
    var seenOne = false;
    for(var i = 0; i < numItems; ++i)
    {
        var item = items[i];
        var pricePlan = item.price;
        if(pricePlan.active)
        {
            if(!seenOne)
            {
                seenOne = true;
                subInfo.contentList += '<table class=\'contentItems\' id=\'table_' + sub.id + '\'><tr><th>Contains plugins</th></tr>';
            }
            var planName = pricePlan.nickname;
            ++subInfo.numItems;
            subInfo.price += pricePlan.unit_amount;
            var allSubKeys = Object.keys(allSubs);
            var numAllSubs = allSubKeys.length;
            for(var j = 0; j < numAllSubs; ++j)
            {
                var tag = allSubKeys[j];
                var subName = allSubs[tag].name;
                if(tag == planName)
                {
                    var subDesc = allSubs[tag].desc;
                    subInfo.contentList += sprintf(g_subContentItemTemplate, tag, sub.id, subDesc);
                    subInfo.tags.push(tag);
                    delete allSubs[tag];
                    if(tag == 'lmaius')
                    {
                        delete allSubs['wwe'];
                    }
                    break;
                }
            }
        }
    }
    if(seenOne)
    {
        subInfo.contentList += '</table>';
    }
    return subInfo;
}

function FormatTimeDateString(dateStarted)
{
    var dtString = dateStarted.toDateString();
    var hours = dateStarted.getHours();
    var mins = ("0" + dateStarted.getMinutes()).slice(-2);
    return dtString + ', ' + hours + ':' + mins;
}

function FormatCurrency(price)
{
    return price / 100;
}

function GetNextPayment(sub, totalPrice)
{
    var status;
    if(sub.status == 'past_due')
    {
        status = 'Overdue ';
    }
    else if(sub.cancel_at_period_end)
    {
        status = 'Cancelling ';
    }
    else
    {
        status = FormatPrice(totalPrice) + ' - ';
    }
    return status + FormatTimeDateString(new Date(sub.current_period_end * 1000));
}

function MakeSubRowButtons(wholeSubButton, subData, subId)
{
    var buttonRowFmt = "<tr>";
    var wholeButtonColspan = "colspan=\"2\"";
    if(subData.tags.length > 1)
    {
        subData.contentList = subData.contentList.replace(/initiallyHidden/g, '');
        buttonRowFmt += sprintf(g_subRemovePluginButtonTemplate, subId);
        wholeButtonColspan = '';
        var removeInfo = GetElement('removePluginText');
        removeInfo.style.display = 'block';
    }
    buttonRowFmt += "<td class=\"rightAlign\"" + wholeButtonColspan + ">";
    buttonRowFmt += wholeSubButton;
    buttonRowFmt += '</td></tr>';
    return buttonRowFmt;
}

function FormatActiveSubRow(sub, allSubs)
{
    var subData = GetSubContent(sub, allSubs);
    var dateStarted = new Date(sub.start_date * 1000);
    var subType = sub.status;
    var cancelling = sub.cancel_at_period_end;
    if((subType == 'active') && (cancelling))
    {
        subType = 'cancelling';
    }
    
    var buttonFmt = cancelling ? g_subUncancelButtonTemplate : g_subCancelButtonTemplate;
    var buttonType = sprintf(buttonFmt, sub.id);
    var btnRow = MakeSubRowButtons(buttonType, subData, sub.id);
    
    var item = sprintf(g_subItemTemplate, subType, subData.contentList, FormatTimeDateString(dateStarted), GetNextPayment(sub, subData.price), btnRow);
    return item;
}

function FormatPastDueSubRow(sub, allSubs)
{
    var subData = GetSubContent(sub, allSubs);
    var dateStarted = new Date(sub.start_date * 1000);
    var subType = 'overdue';
    
    var buttonFmt = g_subPastDueButtonTemplate;
    var buttonType = sprintf(buttonFmt, sub.latest_invoice);
    var btnRow = MakeSubRowButtons(buttonType, subData, sub.id);
    
    var item = sprintf(g_subItemTemplate, subType, subData.contentList, FormatTimeDateString(dateStarted), GetNextPayment(sub, subData.price), btnRow);
    
    return item;
}

function FormatSingleItems(singleItems, allSubs)
{
    var html = '<tr class=\"subItemTableRow\"><td><table class=\"subItemTable subactive\"><tr><td><h2>Non Subscription Upgrades</h2></td></tr><tr><td><ul>';
    var singleItemTags = Object.keys(singleItems);
    var numItems = singleItemTags.length;
    for(var i = 0; i < numItems; ++i)
    {
        var tag = singleItemTags[i];
        var itemDets = singleItems[tag];
        html += '<li>' + itemDets.desc + '</li>';
        delete allSubs[tag];
    }
    html += '</ul></td></tr></table></td></tr>';
    return html;
}

function UpdatePurchases(subs, singleItems, allSubs)
{
    var numSubs = subs.length;
    var innerHtml = "";
    var printedOne = false;
    var numSub = 0;
    for(var i = 0; i < numSubs; ++i)
    {
        var sub = subs[i];
        switch(sub.status)
        {
            case "active":
            {
                if(!sub.cancel_at_period_end)
                {
                    g_activeSubId = sub.id;
                }
                ++numSub;
                innerHtml += FormatActiveSubRow(sub, allSubs, numSub);
                printedOne = true;
            }
            break;
            case "past_due":
            {
                ++numSub;
                innerHtml += FormatPastDueSubRow(sub, allSubs, numSub);
                printedOne = true;
            }
            break;
        }
    }
    if(Object.keys(singleItems).length > 0)
    {
        innerHtml += FormatSingleItems(singleItems, allSubs);
        printedOne = true;
    }
    if(!printedOne)
    {
        innerHtml = "<tr><td><p>None!</p></td></tr>";
    }
    var subDom = GetElement('activeSubList');
    subDom.innerHTML = innerHtml;
}

function sprintf(str) {
    var args = arguments;
    return str.replace(/%(\d)/g, function (x, num) {
        return args[num];
    });
}

function UpdateNewPurchases(available)
{
    var innerHtml = '';
    var newSubKeys = Object.keys(available);
    var numAllSubs = newSubKeys.length;
    if(numAllSubs > 0)
    {
        for(var i = 0; i < numAllSubs; i += 2)
        {
            var j = i + 1;
            var tag = newSubKeys[i];
            var subInfo = available[tag];
            var period = subInfo.isSub ? ' / month' : '';
            innerHtml += '<tr>';
            innerHtml += sprintf(g_newSubRowTemplate, tag, subInfo.desc, FormatCurrency(subInfo.price), period);
            if(j < newSubKeys.length)
            {
                tag = newSubKeys[j];
                subInfo = available[tag];
                period = subInfo.isSub ? ' / month' : '';
                innerHtml += sprintf(g_newSubRowTemplate, tag, subInfo.desc, FormatCurrency(subInfo.price), period);
            }
            innerHtml += '</tr>';
            
        }
        innerHtml += '<tr id="typeHeader" class="initiallyHidden"><td colspan="2"><h3>Choose Payment Type</h3></td></tr>';
        innerHtml += '<tr id="payTypeButtons" class="initiallyHidden"> \
            <td><div class="payTypeButton payTypeSelected" id="subButton" data-subvalue="1" data-checked="1" onclick="SubTypeChange(this);"> \
                                                <h3>Pay As You Go</h3> \
            </td> \
            <td><div class="payTypeButton" id="nonSubButton" data-subvalue="0" data-checked="0" onclick="SubTypeChange(this);"> \
                                                <h3>Pay Upfront for ' + g_monthsSelect + ' months</h3> \
            </td></tr>';
        innerHtml += '<tr> \
            <td class=\"resubButton\" id="stripeBuyCell"> \
                <input class=\"actionButton payButton\" id=\"buyButton\" type=\"submit\" onclick=\"return AddItemsToSubscription(this);\" value=\"Buy With Saved Card/Balance\" disabled /> \
            </td> \
            <td id="ppBuyCell"> \
                <div class=\"ppButton\" id=\"ppPrePay\"></div>';
    }
    else
    {
        innerHtml = '<tr><td><p>None!</p></td></tr>';
    }
    var subDom = GetElement('newSubList');
    subDom.innerHTML = innerHtml;
}

function ShowDetails()
{
    var hiddenDom = GetElement('detailsPanel');
    var loadingDom = GetElement('loadText');
    hiddenDom.style.display = "block";
    loadingDom.style.display = "none";
}

function GetCurrencyChar()
{
    return g_currency == 'usd' ? '$' : '£';
}

function LoadPaypal()
{
    if(!g_ppLoaded)
    {
        var ppScript = document.createElement('script');
        ppScript.setAttribute('type', 'text/javascript');
        var tag = g_ppClientId;
        var currency = g_currency.toUpperCase();
        var srcLoc = sprintf('https://www.paypal.com/sdk/js?client-id=%1&currency=%2&disable-funding=credit,card&intent=capture', tag, currency);
        ppScript.setAttribute('src', srcLoc)
        if(ppScript.readyState)
        {
            ppScript.onreadystatechange = function()
            {
                if(script.readystate == 'complete')
                {
                    g_ppLoaded = true;
                    InitPayPalButtons();
                    ppScript.onreadystatechange = null;
                }
            };
        }
        else
        {
            ppScript.onload = function(){
                g_ppLoaded = true;
                InitPayPalButtons();
            };
        }
        var head = document.getElementsByTagName('head');
        head[0].appendChild(ppScript);
    }
}

function LoadPageData(data)
{
    var dataObject = JSON.parse(data);
    var customer = dataObject.customer;
    g_currency = customer.currency;
    var allSubs = dataObject.subs;
    var itemsBought = dataObject.items;
    var availableSubs = dataObject.available;
    UpdateCustomerDets(customer);
    UpdatePurchases(allSubs, itemsBought, availableSubs);
    UpdateNewPurchases(availableSubs);
    g_availablePurchaseItems = availableSubs;
    FixCurrencyCharacter();
    LoadPaypal();
    ShowDetails();
    InitPayPalButtons();
}

function DoSessionExpired(where)
{
    ShowErrorMsg('Your session has expired. Please <a href=\"/subscription/\">click here</a> to log in again. If this happens for every request you may need to enable cookies for secure.airesoft.co.uk', where);
}

function ConfirmPayment(data, msgLoc)
{
    var genMsg = '<p>Payment succeeded. Please wait a minute or two %1. <a href="javascript:;" onclick="RefreshData();">Click here</a> to reload the page with your new account data';
    var plugMsg = 'and restart LetMeAtIt to use your upgrades';
    var fundMsg = 'to see your updated balance';
    var successMsg = sprintf(genMsg, (msgLoc == 'prepayMsg') ? fundMsg : plugMsg);
    var stripe = Stripe(g_stripe_pk);
    stripe.confirmCardPayment(data).then(function(result)
        {
            if(result.error)
            {
                ShowErrorMsg('<p>Payment failed:</p><blockquote>' + result.error.message + '</blockquote><p>You have not been charged. You may need to update your payment information using the links at the bottom of the page and try again</p><p><a href="javascript:;" onclick="RefreshData();">Click here</a> to reload the page</p>', msgLoc);
            }
            else if(result.paymentIntent)
            {
                ShowSuccessMsg(successMsg, msgLoc);
            }
        }
    );
}

function PayInvoiceCallback(xhr, button)
{
    if(xhr.readyState == 4)
    {
        var invoiceAddend = 'Please <a href="acStripePortal.php" target="_blank">click here</a> to manage your invoices';
        var retData = xhr.responseText;
        switch(xhr.status)
        {
            case 200:
            {
                ShowSuccessMsg('<p>Payment succeeded. Please wait a few minutes and restart LetMeAtIt to use these upgrades</p><p><a href="javascript:;" onclick="RefreshData();">Click here</a> to reload the page with your new account data</p>', 'manageStatusMsg');
            }
            break;
            case 400:
            case 500:
            {
                var errText = '';
                if(retData && (retData.length > 0))
                {
                    errText = ' due to error ' + retData;
                }
                ShowErrorMsg('Payment failed' + errText + '. You have not been charged. ' + invoiceAddend, 'manageStatusMsg');
            }
            break;
            case 402:
            {
                if(retData && (retData != ''))
                {
                    ConfirmPayment(retData, 'manageStatusMsg');
                }
                else 
                {
                    ShowErrorMsg('Payment couldn\'t be completed automatically, ' + invoiceAddend, 'manageStatusMsg');
                }
            }
            break;
            case 403:
            {
                DoSessionExpired('manageStatusMsg');
            }
            break;
        }
    }
}

function CheckoutNewSubCallback(xhr, button)
{
    var retData = xhr.responseText;
    var successMsg = '<p>Payment succeeded.';
    if(g_currency == 'usd')
    {
        successMsg += ' This upgrade requires the new version of LetMeAtIt, if you haven\'t installed it yet, <a href="https://www.airesoft.co.uk/files/LetMeAtIt.zip">please download it here</a></p><p>If you have,';
    }
    successMsg += ' Please wait a minute or two and restart LetMeAtIt to use your upgrades.</p>';
    successMsg += '<p><a href="javascript:;" onclick="RefreshData();">Click here</a> to reload the page with your new account data</p>';
    switch(xhr.status)
    {
        case 200:
        {
            ShowSuccessMsg(successMsg, 'newSubStatusMsg');
        }
        break;
        case 400:
        case 500:
        {
            var errText = ((retData != null) && (retData.length > 0)) ? '</p><blockquote>Error: ' + retData + '.</blockquote><p>' : '';
            ShowErrorMsg('<p>Payment failed. ' + errText + 'You have not been charged. You may need to update your payment information and try again</p>', 'newSubStatusMsg');
        }
        break;
        case 402:
        {
            ConfirmPayment(retData, 'newSubStatusMsg');
        }
        break;
        case 403:
        {
            DoSessionExpired('newSubStatusMsg');
        }
        break;
        case 450:
        {
            ShowErrorMsg('<p>Payment failed. You need to update your payment information using the links at the bottom of the page and try again</p>', 'newSubStatusMsg');
        }
        break;
    }
}

function AddItemsToSubscription(button)
{
    ShowSuccessMsg('', 'newSubStatusMsg');
    button.disabled = true;
    var newSubForm = GetElement('newSubForm');
    var formInputs = newSubForm.getElementsByTagName('input');
    var numInputs = formInputs.length;
    var newUrl = new URL("acSubscription.php?a=n", window.location);
    var sps = newUrl.searchParams;
    var gotOne = false;
    sps.append('id[sub]', g_activeSubId);
    var tagString = '';
    for(var i = 0; i < numInputs; ++i)
    {
        var thisNode = formInputs[i];
        if(thisNode.checked)
        {
            tagString += thisNode.id + ',';
            gotOne = true;
        }
    }
    if(!gotOne)
    {
        button.disabled = false;
        return false;
    }
    sps.append('id[items]', tagString.substring(0, tagString.length - 1));
    newUrl.search = sps.toString();
    //console.log('Making add request to ' + newUrl.toString());
    var subXhr = new XMLHttpRequest();
    subXhr.onreadystatechange = function() {
        if(subXhr.readyState == 4)
        {
            CheckoutNewSubCallback(subXhr, button);
        }
    };
    subXhr.open("POST", newUrl.toString());
    subXhr.setRequestHeader('x-csrf-token', g_token);
    subXhr.send(); 
    return false;
}

function ManageSubCommon(type, newUrl, msgLoc)
{
    var subXhr = new XMLHttpRequest();
    subXhr.onreadystatechange = (type == 'pi') ? 
        function(){PayInvoiceCallback(subXhr);} : 
        function() 
        {
        if(subXhr.readyState == 4)
        {
            var retText = subXhr.responseText;
            switch(subXhr.status)
            {
                case 200:
                {
                    ShowSuccessMsg('<p>Operation succeeded.</p><p>The page will refresh in ten seconds.</p>', msgLoc);
                    setTimeout(RefreshData, 10000);
                }
                break;
                case 402:
                {
                    ConfirmPayment(retText, msgLoc);
                }
                break;
                case 403:
                {
                    DoSessionExpired(msgLoc);
                }
                break;
                case 400:
                case 500:
                {
                    ShowErrorMsg("<p>Operation failed with error:</p><blockquote>" + retText + "</blockquote><p>Please click <a href=\"acStripePortal.php\" target=\"_blank\">here</a> for an alternative method.</p>", msgLoc);
                }
                break;
                default:
                {
                    ShowErrorMsg('Operation failed. Please click <a href=\"acStripePortal.php\"  target=\"_blank\">here</a> to try again.', msgLoc);
                }
                break;
            }
        }
    };
    subXhr.open("POST", newUrl.toString());
    subXhr.setRequestHeader('x-csrf-token', g_token);
    subXhr.send(); 
}

function ManageSub(button, type, subId, msgLoc)
{
    button.disabled = true;
    var url = sprintf('acSubscription.php?a=%1&id=%2', type, subId);
    var newUrl = new URL(url, window.location);
    ManageSubCommon(type, newUrl, msgLoc);
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

function RemoveSubItems(button, subId)
{
    var btnTable = GetElement('table_' + subId);
    var checkedDetails = GetCheckedChildren(btnTable);
    var checkedItems = checkedDetails.checkedItems;
    if(checkedItems.length > 0)
    {
        if(checkedDetails.howMany == checkedItems.length)
        {
            alert('You cannot remove all plugins from the subscription. To cancel the subscription, click the Cancel button');
            return;
        }
        var url = new URL('acSubscription.php?a=r', window.location.href);
        var searchParams = url.searchParams;
        searchParams.append('id[sub]', subId);
        searchParams.append('id[items]', checkedItems.join());
        url.search = searchParams.toString();
        ManageSubCommon('r', url, 'manageStatusMsg');
    }
}

function EnableDisableRemoveButton(subId)
{
    var removeButton = GetElement('remove_' + subId);
    if(removeButton)
    {
        var btnTable = GetElement('table_' + subId);
        removeButton.disabled = (GetCheckedChildren(btnTable).checkedItems.length == 0);
    }
}

function GetCheckedItems()
{
    var buyForm = GetElement('newSubForm');
    var checkedDetails = GetCheckedChildren(buyForm);
    var checkedItems = checkedDetails.checkedItems;
    var numChecked = checkedItems.length;
    var boughtString = '';
    var subAmount = 0;
    var singleAmount = 0;
    var numMonths = GetPrepayMonths();
    for(var i = 0; i < numChecked; ++i)
    {
        var checkedItem = checkedItems[i];
        var item = g_availablePurchaseItems[checkedItem];
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
        subAmount:subAmount * numMonths,
        singleAmount:singleAmount,
        totalAmount:singleAmount + (subAmount * numMonths),
        tagString:boughtString.substring(0, boughtString.length - 2),
        items:checkedItems
    };
}

function FormatPrice(amount)
{
    return GetCurrencyChar() + FormatCurrency(amount);
}

function EnableDisableBuyButton()
{
    var buyCheckInfo = GetCheckedItems();
    var buySpan = GetElement('newTotal');
    var buyButton = GetElement('buyButton');
    var numChecked = buyCheckInfo.items.length;
    buySpan.innerText = FormatCurrency(buyCheckInfo.totalAmount);
    buyButton.disabled = (numChecked == 0);
    var dispType = (buyCheckInfo.subAmount > 0) ? 'table-row' : 'none';
    var textDispType = (numChecked > 0) ? 'block' : 'none';
    ChangeElementDisplay(textDispType, 'buyTotalText');
    ChangeElementDisplay(dispType, 'payTypeButtons', 'typeHeader');
    EnableDisablePPBuyCell(buyCheckInfo);
}

function IsSubSelected()
{
    var subButton = document.getElementById('subButton');
    return parseInt(subButton.getAttribute('data-checked'));
}

function GetPrepayMonths(monthSelector)
{
    if(IsSubSelected()) {return 1;}
    if(monthSelector == null)
    {
        monthSelector = document.getElementById('monthCountNumber');
    }
    var selectedIndex = monthSelector.selectedIndex;
    return parseInt(monthSelector.options[selectedIndex].value);
}

function GetNonSubAmount(monthSelector)
{
    var numMonths = GetPrepayMonths(monthSelector);
    var checkedItems = GetCheckedItems();
    return checkedItems.totalAmount;
}

function UpdateNonSubPrice(monthSelector)
{
    var newAmount = GetNonSubAmount(monthSelector) / 100;
    var priceText = document.getElementById('newTotal');
    priceText.innerText = newAmount;
}

function PPPrePayDetails(data, actions)
{
    var checkedDetails = GetCheckedItems();
    var totalPrice = checkedDetails.totalAmount / 100;
    var hasSub = checkedDetails.subAmount > 0;
    var descString = hasSub ? 'LetMeAtIt Prepayment for ' : 'LetMeAtIt plugin purchase of ';
    descString += checkedDetails.tagString;
    if(hasSub)
    {
        var numMonths = GetPrepayMonths();
        descString += ' (' + numMonths.toString() + ' months)';
    }
    return actions.order.create(
        {
            purchase_units: [{
                "description": descString,
                "amount":{
                    "currency_code":"GBP",
                    "value":totalPrice
                }
            }],
            application_context: {
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW"
            }
        }
    );
}

function RefreshData()
{
    ClearUI();
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function()
    {
        if(xhr.readyState == 4)
        {
            switch(xhr.status)
            {
                case 200: LoadPageData(xhr.responseText); break;
                case 403: ShowExpiredError(); break;
                default: ShowError(xhr.status); break;
            }
        }
    };
    xhr.open("GET", "acGetCustomerInfo.php");
    xhr.setRequestHeader('x-csrf-token', g_token);
    xhr.send();
}

function ClearUI()
{
    GetElement('statusMsg').innerHTML = '';
    GetElement('newSubStatusMsg').innerHTML = '';
    GetElement('manageStatusMsg').innerHTML = '';
    GetElement('prepayMsg').innerHTML = '';
    GetElement('buyTotalText').style.display = 'none';
    GetElement('removePluginText').style.display = 'none';
}

function ShowExpiredError()
{
    ShowErrorMsg("Login has timed out or expired. Please click <a href=\"/subscription/\">here</a> to try again. If this persists you may need to enable cookies for secure.airesoft.co.uk", 'statusMsg');
}

function ShowError(status)
{
    ShowErrorMsg("Data is currently unavailable due to error "+ status + ". Please try again later. If this persists you may need to enable cookies for secure.airesoft.co.uk", 'statusMsg');
}

function ShowErrorMsg(msg, where)
{
    var errDom = GetElement(where);
    errDom.style.color = "red";
    errDom.innerHTML = msg;
}

function ShowSuccessMsg(msg, where)
{
    var sucDom = GetElement(where);
    sucDom.style.color = "green";
    sucDom.innerHTML = msg;
}

function DoBuyConversion(selectId, resultId)
{
    var buyCheckInfo = GetCheckedItems();
    DoCurrencyConversion(selectId, resultId, buyCheckInfo.totalAmount / 100, g_currency);
}

function DoPrepayConversion(selectId, resultId)
{
    var value = GetElement('fundAmount');
    var amount = value.valueAsNumber;
    if(isNaN(amount) || (amount < 4.99))
    {
        GetElement(resultId).innerText = 'Amount is not a number or is less than 4.99';
        return;
    }
    DoCurrencyConversion(selectId, resultId, amount, g_currency);
}

function CheckPrePay(element)
{
    var fundAmountBox = GetElement(element);
    var fundAsString = fundAmountBox.value;
    var fundAmount = fundAmountBox.valueAsNumber;
    if(isNaN(fundAmount) || (fundAmount < 4.99))
    {
        fundAmountBox.style.color = 'red';
        return null;
    }
    return {number:fundAmount, text:fundAsString};
}

function DoPrePay(button)
{
    var amount = CheckPrePay('fundAmount');
    if(amount == null) return;
    ManageSub(button, 'pp', Math.trunc(amount.number * 100), 'prepayMsg');
}

function InitPayPalButtons() 
{
    if(!g_ppLoaded)
    {
        return;
    }
    if(!g_ppInitialised)
    {
        // this button is in a static part of the page
        // and only needs to be initialised once, since Refresh doesn't clear it
        var ppFundButton = paypal.Buttons({
            style: {
              shape: 'rect',
              color: 'gold',
              layout: 'horizontal',
              label: 'pay',
              tagline: 'false'
            },
            createOrder: PPFundDetails,
            onApprove: function(data, actions) {
                return actions.order.capture().then(function(details) {
                    GoodPPPayment('fundResult', details.payer.email_address, details.id);
                });
            },
            onError: function(err) {
              BadPPPayment('fundResult', err);
            }
        });
        ppFundButton.render('#ppFundBtn');
    }
    // this one is in a dynamic part of the page and needs initialising on every refresh
    var ppPrepaySubButton = paypal.Buttons({
        style: {
          shape: 'rect',
          color: 'gold',
          layout: 'horizontal',
          label: 'buynow',
          tagline: 'false'
        },
        createOrder: PPPrePayDetails,
        onApprove: function(data, actions) {
            return actions.order.capture().then(function(details) {
                GoodPPPayment('newSubStatusMsg', details.payer.email_address, details.id);
            });
        },
        onError: function(err) {
          BadPPPayment('newSubStatusMsg', err);
        }
    });
    g_ppInitialised = true;
    ppPrepaySubButton.render('#ppPrePay');
}

function PPFundDetails(data, actions)
{
    var amount = CheckPrePay('fundAmount');
    if(amount == null) return null;
    return actions.order.create(
        {
            purchase_units: [{
                "description": 'LetMeAtIt Account Prepayment',
                "amount":{
                    "currency_code":'GBP',
                    "value":amount.number
                }
            }],
            application_context: {
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW"
            }
        }
    );
}

function SendDifferentEmailNotice(ppEmail, customerEmail, ppTransId)
{
    var xhr = new XMLHttpRequest();
    var url = new URL('acNotice.php', window.location.href);
    var searchParams = url.searchParams;
    searchParams.append('c', customerEmail);
    searchParams.append('pp', ppEmail);
    searchParams.append('id', ppTransId);
    url.search = searchParams.toString();
    xhr.open("POST", url.toString());
    xhr.setRequestHeader('x-csrf-token', g_token);
    xhr.send();
}

function GoodPPPayment(where, email, transId)
{
    var html = '<p>Paypal payment success<br/>Paypal payments are processed manually so the payment/plugin will show in your account shortly</p>';
    ShowSuccessMsg(html, where);
    if(email != g_customer.email)
    {
        SendDifferentEmailNotice(email, g_customer.email, transId);
    }
}

function BadPPPayment(where, err)
{
    var html = '<p>Paypal payment failed with error \'' + err + '\'.<br/>You have not been charged. Please try again.</p>';
    ShowErrorMsg(html, where);
}

function FixCurrencyCharacter()
{
    var currencyPositions = document.getElementsByClassName('currencyCharacter');
    var numPositions = currencyPositions.length;
    var curChar = GetCurrencyChar();
    for(var i = 0; i < numPositions; ++i)
    {
        currencyPositions[i].innerText = curChar;
    }
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
        else console.log('ChangeElementDisplay: ' + elements[i] + ' doesn\' exist!');
    }
}

function DecrementColspan(id)
{
    var tableCell = GetElement(id);
    tableCell.colSpan = Math.max(tableCell.colSpan - 1, 1);
}

function IncrementColspan(id)
{
    var tableCell = GetElement(id);
    tableCell.colSpan = Math.min(tableCell.colSpan + 1, 2);
}

function EnableDisablePPBuyCell(checkedInfo)
{
    var isSub = IsSubSelected();
    var buyButton = GetElement('buyButton');
    if(isSub && (checkedInfo.subAmount > 0))
    {
        ChangeElementDisplay('none', 'ppBuyCell');
        IncrementColspan('stripeBuyCell');
        buyButton.innerText = 'Buy With Saved Card/Balance';
        
    }
    else
    {
        DecrementColspan('stripeBuyCell');
        ChangeElementDisplay('table-cell', 'ppBuyCell');
        buyButton.innerText = 'Buy With Saved Card';
    }
}

function SubTypeChange(changed)
{
    var isSub = parseInt(changed.getAttribute('data-subvalue'));
    var buttons = document.getElementsByClassName('payTypeButton');
    var numButtons = buttons.length;
    var selectedClass = ' payTypeSelected';
    for(var i = 0; i < numButtons; ++i)
    {
        var thisButton = buttons[i];
        if(thisButton == changed)
        {
            if(thisButton.getAttribute('data-checked') == '1')
            {
                break;
            }
            thisButton.setAttribute('data-checked', '1');
            thisButton.className += selectedClass;
        }
        else
        {
            if(thisButton.getAttribute('data-checked') == '0')
            {
                break;
            }
            thisButton.setAttribute('data-checked', '0');
            thisButton.className = thisButton.className.replace(selectedClass, '');
        }
    }
    EnableDisablePPBuyCell(GetCheckedItems());
    UpdateNonSubPrice(GetElement('monthCountNumber'));
}