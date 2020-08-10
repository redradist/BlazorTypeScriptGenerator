using System.Text.Json.Serialization;
using BlazorBrowser.Extensions;

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
        {%- if prop_info.type == "void" %}
        public ValueTask {{ prop_name[0].toUpperCase() + prop_name.slice(1) }}Async()
        {%- else %}
        public ValueTask<{{ prop_info.type }}> {{ prop_name[0].toUpperCase() + prop_name.slice(1) }}Async()
        {%- endif %}
        {
            {%- if prop_info.type != "void" %}
            return JSRuntime.InvokeAsync<{{ prop_info.type }}>("blazorBrowser.invokeInstanceMethod", JSObjectRef, "{{ prop_name }}");
            {%- else %}
            return JSRuntime.InvokeVoidAsync("blazorBrowser.invokeInstanceMethod", JSObjectRef, "{{ prop_name }}");
            {%- endif %}
        }
    {%- else %}
        {%- if prop_info.isRefType %}
        public ValueTask<JSRuntimeObjectRef> Get{{ prop_name[0].toUpperCase() + prop_name.slice(1) }}Async()
        {%- else %}
        public ValueTask<{{ prop_info.type }}> Get{{ prop_name[0].toUpperCase() + prop_name.slice(1) }}Async()
        {%- endif %}
        {
            return JSRuntime.InvokeAsync<{{ prop_info.type }}>("blazorBrowser.getInstanceProperty", JSObjectRef, "{{ prop_name }}");
        }
        {% if not prop_info.isReadonly -%}
        public ValueTask Set{{ prop_name[0].toUpperCase() + prop_name.slice(1) }}Async({{ prop_info.type }} value)
        {
            return JSRuntime.InvokeVoidAsync("blazorBrowser.setInstanceProperty", JSObjectRef, "{{ prop_name }}", value);
        }
        {% endif -%}
    {% endif -%}
{%- endfor %}
    }
}
