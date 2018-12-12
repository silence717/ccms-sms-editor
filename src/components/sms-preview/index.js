import angular from 'angular';
import ddo from './SMSPreview';


export default angular
	.module('ccms.components.sms.SMSPreview', [])
	.directive('ccSmsPreview', () => ddo)
	.name;
