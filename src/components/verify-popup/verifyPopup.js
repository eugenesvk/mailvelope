/**
 * Mailvelope - secure email with OpenPGP encryption for Webmail
 * Copyright (C) 2012-2015 Mailvelope GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

var mvelo = mvelo || null; // eslint-disable-line no-var

(function() {
  // communication to background page
  let port;
  // shares ID with VerifyFrame
  let id;
  // type + id
  let name;
  // dialogs
  let sandbox;
  let l10n;

  function init() {
    let qs = jQuery.parseQuerystring();
    id = qs.id;
    name = `vDialog-${id}`;
    // open port to background page
    port = mvelo.extension.connect({name});
    port.onMessage.addListener(messageListener);
    port.postMessage({event: 'verify-popup-init', sender: name});
    addSandbox();
    addErrorView();
    addSecuritySettingsButton();
    $('#closeBtn').click(onCancel);
    $('#copyBtn').click(onCopy);
    $('body').addClass('spinner');

    $(window).on('beforeunload', onClose);

    mvelo.l10n.localizeHTML();
    mvelo.l10n.getMessages([
      'verify_result_success',
      'verify_result_warning',
      'verify_result_error',
      'alert_header_error',
      'dialog_keyid_label'
    ], result => {
      l10n = result;
    });
    mvelo.util.showSecurityBackground();
  }

  function addSecuritySettingsButton() {
    let securitySettingsBtn = $('<div data-l10n-title-id="security_background_button_title" class="pull-right"><span class="glyphicon lockBtnIcon"></span></div>');
    $('.modal-body .header').append(securitySettingsBtn);
  }

  function onCancel() {
    $(window).off('beforeunload');
    logUserInput('security_log_dialog_ok');
    port.postMessage({event: 'verify-dialog-cancel', sender: name});
    return false;
  }

  function onClose() {
    port.postMessage({event: 'verify-dialog-cancel', sender: name});
  }

  function onCopy() {
    logUserInput('security_log_content_copy');
    // copy to clipboard
    let doc = sandbox.contents().get(0);
    let sel = doc.defaultView.getSelection();
    sel.selectAllChildren(sandbox.contents().find('#content').get(0));
    doc.execCommand('copy');
    sel.removeAllRanges();
  }

  function addSandbox() {
    sandbox = $('<iframe/>', {
      sandbox: 'allow-same-origin allow-popups',
      frameBorder: 0
    });
    let header = $('<header/>');
    let content = $('<div/>', {
      id: 'content'
    }).append(header);
    let style = $('<link/>', {
      rel: 'stylesheet',
      href: '../../dep/bootstrap/css/bootstrap.css'
    });
    let style3 = style.clone().attr('href', '../../components/verify-popup/verifyPopupSig.css');
    let meta = $('<meta/>', {charset: 'UTF-8'});
    sandbox.one('load', () => {
      sandbox.contents().find('head').append(meta)
      .append(style)
      .append(style3);
      sandbox.contents().find('body').append(content);
    });
    $('.modal-body .content').append(sandbox);
  }

  function addErrorView() {
    let errorbox = $('<div/>', {id: 'errorbox'});
    $('<div/>', {id: 'errorwell', class: 'well'}).appendTo(errorbox);
    $('.modal-body .content').append(errorbox);
  }

  function showError(msg) {
    // hide sandbox
    $('.modal-body iframe').hide();
    $('#errorbox').show();
    $('#errorwell').showAlert(l10n.alert_header_error, msg, 'danger');
    $('#copyBtn').prop('disabled', true);
  }

  /**
   * send log entry for the extension
   * @param {string} type
   */
  function logUserInput(type) {
    port.postMessage({
      event: 'verify-user-input',
      sender: name,
      source: 'security_log_verify_dialog',
      type
    });
  }

  function messageListener(msg) {
    // remove spinner for all events
    $('body').removeClass('spinner');
    switch (msg.event) {
      case 'verified-message': {
        // js execution is prevented by Content Security Policy directive: "script-src 'self' chrome-extension-resource:"
        let message = msg.message.replace(/\n/g, '<br>');
        const node = sandbox.contents();
        const header = node.find('header');
        msg.signers.forEach(signer => {
          let type;
          let userid;
          const message = $('<span/>');
          const keyid = $('<span/>');
          keyid.text(`(${l10n.dialog_keyid_label} ${signer.keyid.toUpperCase()})`);
          if (signer.userid) {
            userid = $('<strong/>');
            userid.text(signer.userid);
          }
          if (signer.userid && signer.valid) {
            type = 'success';
            message.append(l10n.verify_result_success, ' ', userid, ' ', keyid);
          } else if (!signer.userid) {
            type = 'warning';
            message.append(l10n.verify_result_warning, ' ', keyid);
          } else {
            type = 'danger';
            message.append(l10n.verify_result_error, ' ', userid, ' ', keyid);
          }
          header.showAlert('', message, type, true);
        });
        message = $.parseHTML(message);
        node.find('#content').append(message);
        break;
      }
      case 'error-message':
        showError(msg.error);
        break;
      default:
        console.log('unknown event', msg.event);
    }
  }

  $(document).ready(init);
}());
