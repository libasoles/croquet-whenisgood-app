import { Model, View, Constants } from "@croquet/croquet";
import { MultiRangeSlider } from "./components/MultiRangeSlider";
import { SingleRangeSlider } from "./components/SingleRangeSlider";
import i18next from "i18next";
import { element } from "./utils";

const Q = Constants;
// Q.daysRangeMinMax = [0, 14];
// Q.timeRangeMinMax = [0, 24];

export default class Settings extends Model {
  init(_, persistedState = {}) {
    this.hydrate(persistedState);

    // TODO: constants should be in Q
    this.daysRangeMinMax = [0, 14];
    this.timeRangeMinMax = [0, 24];
    this.durationMinMax = [1, 5];

    this.subscribe("settings", "days-range-change", this.daysRangeChange);
    this.subscribe("settings", "time-range-change", this.timeRangeChange);
    this.subscribe(
      "settings",
      "allow-weekends-change",
      this.allowWeekendsChange
    );
    this.subscribe("settings", "half-hours-change", this.halfHoursChange);
    this.subscribe("settings", "duration-change", this.durationChange);
  }

  hydrate(persistedState) {
    const { daysRange, timeRange, allowWeekends, duration } = persistedState;

    this.daysRange = daysRange ? daysRange : [0, 4];
    this.timeRange = timeRange ? timeRange : [9, 18];
    this.duration = duration ? duration : 1;
    this.allowWeekends = allowWeekends ? allowWeekends : false;
  }

  save() {
    this.wellKnownModel("modelRoot").save();
  }

  serialize() {
    return {
      daysRange: this.daysRange,
      timeRange: this.timeRange,
      allowWeekends: this.allowWeekends,
      duration: this.duration,
    };
  }

  daysRangeChange(values) {
    this.daysRange = [values.lower, values.upper];
    this.save();

    this.publish("settings", "update-days-range", values);
  }

  timeRangeChange(values) {
    this.timeRange = [values.lower, values.upper];

    this.save();

    this.publish("settings", "update-time-range", values);
  }

  durationChange(value) {
    this.duration = value;

    this.save();

    this.publish("settings", "update-duration", value);
  }

  allowWeekendsChange(value) {
    this.allowWeekends = value;

    this.save();

    this.publish("settings", "update-allow-weekends", value);
  }

  halfHoursChange(value) {
    this.halfHourIntervals = value;

    this.save();

    this.publish("settings", "update-half-hours", value);
  }
}

export class SettingsView extends View {
  constructor(model, identity) {
    super(model);
    this.model = model;
    this.identity = identity;

    this.subscribe("identity", "established", this.collapse);
    this.subscribe("settings", "update-days-range", this.updateDaysRange);
    this.subscribe("settings", "update-time-range", this.updateTimeRange);
    this.subscribe(
      "settings",
      "update-allow-weekends",
      this.updateWeekendsCheckbox
    );
    this.subscribe(
      "settings",
      "update-half-hours",
      this.updateHalfHoursCheckbox
    );
    this.subscribe("settings", "update-duration", this.updateDuration);

    this.initRangeSliders();

    this.initToggleChevron();

    this.initWeekendsCheckbox();
    this.initHafHoursCheckbox();
  }

  collapse({ userId }) {
    const selfId = this.identity.selfId(this.viewId);

    const collapsedByDefault =
      userId === selfId && this.identity.numberOfUsers() > 1;

    if (collapsedByDefault)
      element(".column.side.left").classList.add("collapsed");
  }

  initToggleChevron() {
    element(".toggle-settings").onclick = () => {
      element(".column.side.left").classList.toggle("collapsed");
    };
  }

  initWeekendsCheckbox() {
    this.includeWeekends = element(".include-weekends input");

    this.includeWeekends.checked = this.model.allowWeekends;

    this.includeWeekends.onchange = (event) => {
      this.publish(
        "settings",
        "allow-weekends-change",
        event.currentTarget.checked
      );
    };
  }

  initHafHoursCheckbox() {
    this.halfHourIntervals = element(".half-hours input");

    this.halfHourIntervals.checked = this.model.halfHourIntervals;

    this.halfHourIntervals.onchange = (event) => {
      this.publish(
        "settings",
        "half-hours-change",
        event.currentTarget.checked
      );
    };
  }

  initRangeSliders() {
    this.initDaysRangeSlider();
    this.initTimeRangeSlider();
    this.initDurationSlider();
  }

  initDaysRangeSlider() {
    const selector = element(".days-range");

    const [min, max] = this.model.daysRangeMinMax;
    const [lower, upper] = this.model.daysRange;

    const onChange = (values) => {
      this.publish("settings", "days-range-change", values);
    };

    const formatValue = (value) => {
      return value === 0 ? i18next.t("today") : value + 1;
    };

    this.daysRangeSlider = new MultiRangeSlider(
      selector,
      { min, max, lower, upper },
      { onChange, formatValue }
    );
  }

  initTimeRangeSlider() {
    let selector = element(".time-range");

    const [min, max] = this.model.timeRangeMinMax;
    const [lower, upper] = this.model.timeRange;

    const onChange = (values) => {
      this.publish("settings", "time-range-change", values);
    };

    const formatValue = (value) => {
      return value + "hs";
    };

    this.hoursRangeSlider = new MultiRangeSlider(
      selector,
      { min, max, lower, upper },
      { onChange, formatValue }
    );
  }

  initDurationSlider() {
    let selector = element(".duration");

    const [min, max] = this.model.durationMinMax;
    const duration = this.model.duration;

    const onChange = ({ value }) => {
      this.publish("settings", "duration-change", value);
    };

    const formatValue = (value) => {
      return value + "hs"; // TODO: mins if less than 1hs
    };

    // TODO: react to 30mins settings
    this.durationSlider = new SingleRangeSlider(
      selector,
      { min, max, initialValue: duration },
      {
        onChange,
        formatValue,
      }
    );

    this.renderDuration(duration);
  }

  updateDaysRange({ lower, upper }) {
    this.daysRangeSlider.update(lower, upper);
  }

  updateTimeRange({ lower, upper }) {
    this.hoursRangeSlider.update(lower, upper);
  }

  updateWeekendsCheckbox(checked) {
    this.includeWeekends.checked = checked;
  }

  updateHalfHoursCheckbox(checked) {
    this.halfHourIntervals.checked = checked;
  }

  updateDuration(value) {
    this.renderDuration(value);

    this.durationSlider.update(value);
  }

  renderDuration(value) {
    element(".calendar .duration").textContent = `${i18next.t(
      "duration"
    )}: ${value}hs`;
  }
}
