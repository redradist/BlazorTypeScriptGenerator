using System.Text.Json.Serialization;


namespace BlazorBrowser{% if objectNamespace %}.{% endif %}{{objectNamespace}}
{
    public class {{objectName}}
        {%- if extendedClasses -%}
        :
            {%- for cls in extendedClasses -%}
              {{- cls }}{{ ", " if not loop.last }}
            {%- endfor %}
        {%- endif %}
    {
        protected readonly IJSRuntime JSRuntime { get; internal set; }

        protected readonly JSRuntimeObjectRef JSObjectRef { get; internal set; }

        internal {{objectName}}(IJSRuntime jsRuntime, JSRuntimeObjectRef jsObjectRef)
        {
            JSRuntime = jsRuntime;
            JSObjectRef = jsObjectRef;
        }
{% for prop_name, prop_info in properties %}
    {%- if prop_info.isMethod %}
        public {{ prop_info.type }} {{ prop_name[0].toUpperCase() +
                                       prop_name.slice(1) }}()
        {
            {%- if prop_info.type != "void" %}
            return await JSRuntime.InvokeAsync<{{ prop_info.type }}>("window.{{ prop_name }}");
            {%- else %}
            await JSRuntime.InvokeVoidAsync("window.{{ prop_name }}");
            {%- endif %}
        }
    {%- else %}
        public {{ prop_info.type }} {{ prop_name[0].toUpperCase() +
                                       prop_name.slice(1) }} { get; {% if prop_info.isReadonly %}internal{% endif %} set; }
    {% endif %}
{%- endfor -%}
    }
}
